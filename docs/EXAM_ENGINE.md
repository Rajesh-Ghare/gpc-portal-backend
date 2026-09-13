# Exam Engine

## Status

**Implemented and verified (Phase 7)** — attempt creation (manual and
rule-based selection), answer autosave, the backend-authoritative timer with
auto-submit on expiry, transactional idempotent submission with MCQ_SINGLE
evaluation, and result retrieval respecting a test's visibility flags.
Verified manually against a real running server/database (including a real
2-second-duration test to observe auto-submit fire) and via 5 automated
integration tests (`tests/integration/attempt.test.ts`), one of which
exercises the Phase 2 partial unique index directly at the database level.

Two real bugs were caught during manual testing and fixed before this was
considered done — see "Bugs Found During Implementation" below. Manual
end-to-end testing caught both; neither would have been caught by
type-checking or a narrower unit test.

## Attempt Start

Validated, in order, by `createAttempt()` (`src/services/attemptService.ts`,
`POST /tests/:testId/attempts`):

1. Authentication (valid session — `authenticate` middleware).
2. If an `IN_PROGRESS` attempt already exists for this user/test, it is
   returned as-is (resume), not treated as an error — verified this doesn't
   double-charge the entitlement (`attempts_used` only increments once).
3. Test status is `PUBLISHED` and current time is within `available_from`/
   `available_until` (`getPublishedTestOrThrow`, `testBrowseService.ts`).
4. Entitlement: an active, non-revoked `entitlements` row covering this test
   — directly (`INDIVIDUAL_TEST`), via its exam (`EXAM_PACKAGE`), via its
   series if any (`TEST_SERIES`), or a blanket `SUBSCRIPTION`/`ALL_ACCESS`
   item (`findActiveEntitlementForTest`, `entitlementService.ts`).
   `SUBJECT_PACKAGE` is not resolved — see ADR-026.
5. `attempt_policy = SINGLE` blocks a second attempt outright; entitlement's
   `attempt_limit`/`attempts_used` is checked otherwise (`null` limit =
   unlimited).
6. Question selection (below) — a `RULE_BASED` test whose rules can't
   currently be satisfied throws `TEST_NOT_AVAILABLE` at this point (a
   narrower, later check than `validateTest()`'s publish-time check, since
   the approved-question pool can shrink after publish).

`attempts` + `attempt_questions` are created inside **one
`sequelize.transaction()`**, and the qualifying entitlement's
`attempts_used` is incremented in the same transaction — not as a
best-effort side effect (per `docs/COMMERCE_AND_PAYMENTS.md`).

## Attempt Snapshot (ADR-008) — Verified

Once `attempt_questions` rows are written, `question_id`/
`question_version_id`/`sequence_number`/`marks`/`negative_marks` are fixed
for that attempt. Every read path (`getAttemptDetail`, `submitAttempt`,
`getResult`) reads only from `attempt_questions`/`attempt_answers` — never
re-resolves `test_questions`/`test_rules` live.

## Timer (ADR-009) — Verified

- `attempts.started_at`/`expires_at` are set once, server-side, at creation
  (`expires_at = started_at + tests.duration_seconds`).
- `GET /attempts/:id` returns a computed `remainingSeconds` (clamped to 0);
  the frontend must only display this, never run its own countdown as the
  source of truth.
- **`autoSubmitIfExpired()`** runs at the start of `getAttemptDetail`,
  `saveAnswer`, and (implicitly, since it's a no-op past that point)
  `submitAttempt` itself: if an `IN_PROGRESS` attempt's `expires_at` has
  passed, it is submitted immediately (`auto_submitted = true`) before the
  requested operation proceeds. Verified with a real 1-second-duration test:
  after the timer lapsed, `GET /attempts/:id` transparently returned
  `status: SUBMITTED` and a `results` row existed with unanswered questions
  scored 0 — the student never had to call `/submit` themselves.

## Answer Autosave — Verified

```
Student selects an answer
  → UI updates optimistically
  → PUT /attempts/:attemptId/questions/:attemptQuestionId/answer
  → backend validates ownership (attemptPolicy) + attempt status + time +
    option validity (selected_option_id must belong to this exact
    question_version_id — errorCode INVALID_OPTION, its first real use)
  → attempt_answers row upserted (answered_at set only when a real answer
    value is given; last_saved_at always)
  → response confirms persisted state
```

An expired attempt returns `ATTEMPT_EXPIRED`; an already-(explicitly)-
submitted one returns `ATTEMPT_ALREADY_SUBMITTED` — the service
distinguishes these via the attempt's `auto_submitted` flag after
`autoSubmitIfExpired()` runs, so the client can tell "time ran out" from
"you already finished" apart.

Frontend must show Saving / Saved / Not saved state and must not let a failed
network request silently drop an answer — retry or surface a clear "not saved"
state with a retry action, and keep the not-yet-confirmed answer in local
component/query state until the server confirms it. (Not yet built — this is
frontend work, Phase 12.)

## Submission (Transactional, Idempotent) — Verified

```
BEGIN
  lock the attempt row (SELECT ... FOR UPDATE, transaction.LOCK.UPDATE)
  verify ownership (attemptPolicy.ensureOwnsAttempt)
  if status is SUBMITTED: return the existing result (idempotent, no
    recompute) — verified via a real resubmit returning the identical
    result id
  determine auto_submitted = now() > expires_at
  load attempt_questions + attempt_answers + question (for questionType)
  evaluate each via the evaluator registry (getEvaluator(questionType))
  accumulate totals: attempted/correct/incorrect/unanswered, total/scored/
    negative marks, percentage, accuracy, time_taken_seconds
  create results row (released_at = now() if test.result_visibility is
    IMMEDIATE, else null; rank/percentile always null here — they're a
    cross-attempt aggregate computed separately, see "Rank & Percentile"
    below and docs/DECISIONS.md ADR-027/ADR-029)
  create result_details rows (one per attempt_question)
  mark attempt SUBMITTED (submitted_at = now(), auto_submitted)
COMMIT
```

Scoring verified against a hand-checked case: 1 correct (1.00), 1 incorrect
(−0.25 negative), 2 unanswered (0) → `percentage = (1 − 0.25) / 4 × 100 =
18.75%`, `accuracyPercentage = 1/2 × 100 = 50%` — matched exactly.

## Rank & Percentile — Implemented (Phase 8)

`rank`/`percentile` are cross-attempt aggregates, deliberately **not**
computed during `submitAttempt()` (ADR-027). They're computed by
`POST /admin/tests/:testId/results/release` (`resultService.releaseResults`
→ `src/utils/rankings.ts`'s `computeRankings`) — standard competition
ranking (tied net scores share a rank; the next distinct score skips ahead
by the number tied) and percentile = share of that test's evaluated
attempts scoring strictly lower (ADR-029). This recomputes for *every*
evaluated result each time it's called — safe and idempotent on the
release-timestamp side (already-released results keep their original
`released_at`), even though rank/percentile values are refreshed to
reflect the full current set. Verified with 3 students (1 correct, 1
wrong, 1 unanswered — the latter two tied at 0): top scorer got rank 1 /
66.67th percentile, the tied pair both got rank 2 / 0th percentile.

Until an admin calls this endpoint at least once, `show_rank`/
`show_percentile` on a test will show `null` for both fields — this is the
expected default, not a bug (see ADR-027).

## Question Selection Strategies — Implemented

`src/strategies/questionSelection/`:

- `ManualSelectionStrategy` — uses `test_questions` rows directly, in
  `display_order`, falling back to the test's `default_marks_per_question`/
  `default_negative_marks` when a row doesn't override them.
- `RuleBasedSelectionStrategy` — evaluates `test_rules` in `display_order`,
  randomly picking `question_count` `PUBLISHED`+`APPROVED` questions per
  rule from those matching its subject/topic/type/difficulty/tags filter
  (tag match is "any of"), excluding questions already chosen by an earlier
  rule in the same attempt so the same question is never selected twice.
  Throws `TEST_NOT_AVAILABLE` if a rule can't currently be satisfied.
  Verified: a rule requesting 2 questions from a pool of several correctly
  returned 2 distinct questions with their latest approved version.

Both strategies produce the same output shape
(`{questionId, questionVersionId, sectionId, marks, negativeMarks}`,
`SelectedQuestion` in `QuestionSelectionStrategy.ts`) — `createAttempt()`
doesn't know or care which strategy produced the list. If
`test.randomize_questions` is true, the combined list is shuffled
(Fisher-Yates, `src/utils/shuffle.ts`) before sequence numbers are assigned.
`randomize_options` (per-attempt option display order) is **not**
implemented — see `docs/KNOWN_ISSUES.md`.

## Evaluation Strategies — MCQ_SINGLE Implemented

`src/strategies/evaluation/`: `getEvaluator(questionType)` returns the
right `Evaluator` for a question type. `McqSingleEvaluator` compares
`selected_option_id` against the version's `is_correct` option and returns
`CORRECT`/`INCORRECT`/`UNANSWERED` plus marks/negative-marks awarded. Any
other `questionType` falls back to an `UnsupportedTypeEvaluator` that scores
`UNANSWERED`/0 rather than throwing — because nothing today actually stops
a non-MCQ_SINGLE question from being added to a test (Phase 6's
`test_questions` assignment only checks `reviewStatus`, not `questionType`)
— see `docs/KNOWN_ISSUES.md`. Add a real evaluator here (and remove the
fallback's silent handling for that type) as each type's grading logic is
built — the registry pattern (this switch statement) is the only thing that
needs to change; `submitAttempt()` itself is type-agnostic.

## Security — Verified

**During an active attempt, the API must never expose `is_correct` or
`correct_option_id`.** This was violated during initial implementation:
`createAttempt()`'s success response returned the raw eager-loaded
Sequelize result (including `is_correct` on every option) instead of the
same sanitized shape `getAttemptDetail()` builds. Caught by manual testing
(`grep -c isCororrect` on the actual HTTP response), fixed by routing
`createAttempt()`'s response through `getAttemptDetail()` instead of a
separate raw query — there is now exactly one code path that ever
serializes attempt-question data for the student, not two. See
`docs/SECURITY.md`.

## Question Renderer Registry (Frontend)

```ts
const questionRendererRegistry = {
  MCQ_SINGLE: MCQSingle,
  MCQ_MULTI: MCQMulti,
  TRUE_FALSE: TrueFalse,
  NUMERIC: Numeric,
  SHORT_TEXT: ShortText,
  LONG_TEXT: Essay,
};
```

Rendering logic must be looked up via this registry, never hardcoded
`if (question.type === 'MCQ_SINGLE')` branches spread through the UI.
`GET /attempts/:id`'s response shape (`question.questionType`,
`question.options[].text`, no correctness data) is what this registry
renders against — `questionType` was added to that response in Phase 12
specifically so the frontend could key off it (it was missing before:
`getAttemptDetail()` only ever eager-loaded `questionVersion`, never the
parent `Question` row that actually holds `questionType`).
