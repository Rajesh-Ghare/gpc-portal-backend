# Exam Engine

## Attempt Start

Validated, in order, before an attempt is created (`POST /tests/:testId/attempts`):

1. Authentication (valid session).
2. Entitlement (an active, non-expired, non-revoked `entitlements` row covering
   this test, directly or via its test_series/exam/subject).
3. Test status is `PUBLISHED`.
4. Current time is within `available_from` / `available_until`.
5. `attempt_policy` allows a new attempt (re-attempts allowed? limit reached?).
6. Remaining attempts against the entitlement's `attempt_limit`/`attempts_used`.
7. Test configuration is valid (has questions or valid rules; duration set).
8. Question availability (enough approved questions exist to satisfy manual
   list or rule counts).

All of the above plus attempt + attempt_questions creation happens inside a
**single database transaction**. If question selection is rule-based
(`selection_mode = RULE_BASED`), `test_rules` are evaluated inside this same
transaction (ADR-010).

## Attempt Snapshot (ADR-008)

Once `attempt_questions` rows are written:

- `question_id` + `question_version_id` are fixed.
- `sequence_number` (order) is fixed.
- `marks` / `negative_marks` are fixed (copied from the test/section/question
  version at creation time, not looked up live afterward).

Later edits to the question bank, test, or test_questions must never change an
existing attempt's questions, order, or marks. Read paths for an in-progress or
completed attempt always read from `attempt_questions`/`attempt_answers`, never
by re-resolving `test_questions` live.

## Timer (ADR-009)

- `attempts.started_at` and `attempts.expires_at` are set once, server-side, at
  creation (`expires_at = started_at + tests.duration_seconds`).
- The frontend computes and displays a countdown from these two values (fetched
  from the server); it never runs its own authoritative clock.
- Every autosave request and the submit request re-check
  `now() <= expires_at`; the backend auto-submits (sets `auto_submitted = true`)
  an attempt whose time has expired rather than trusting the client to call
  submit on time.

## Answer Autosave

```
Student selects an answer
  → UI updates optimistically
  → PUT /attempts/:attemptId/questions/:attemptQuestionId/answer
  → backend validates ownership + attempt status + time + option validity
  → attempt_answers row upserted (answered_at, last_saved_at)
  → response confirms persisted state
```

Frontend must show Saving / Saved / Not saved state and must not let a failed
network request silently drop an answer — retry or surface a clear "not saved"
state with a retry action, and keep the not-yet-confirmed answer in local
component/query state until the server confirms it.

## Submission (Transactional, Idempotent)

```
BEGIN
  lock the attempt row (SELECT ... FOR UPDATE)
  verify ownership (attempt.user_id === current user)
  verify status is IN_PROGRESS (if already SUBMITTED, return the existing
    result instead of recomputing — idempotency)
  verify time (now() <= expires_at, else mark auto_submitted)
  load attempt_questions + attempt_answers
  evaluate each answer via the question-type evaluation strategy
  calculate totals (scored_marks, negative_marks, accuracy, etc.)
  create results row
  create result_details rows
  mark attempt SUBMITTED (submitted_at = now())
COMMIT
```

Repeated `POST /attempts/:attemptId/submit` calls for an already-submitted
attempt must be safe (return the existing result, not create a duplicate).

## Question Selection Strategies

`src/strategies/questionSelection/`:

- `ManualSelectionStrategy` — uses `test_questions` rows directly, in
  `display_order`.
- `RuleBasedSelectionStrategy` — evaluates `test_rules` (filtered by subject,
  topic, question_type, difficulty, language, tags via `test_rule_tags`) to
  pick `question_count` approved questions per rule, then orders sections/
  questions per test configuration (`randomize_questions`,
  `randomize_options`).

Both strategies produce the same output shape (an ordered list of
`{questionId, questionVersionId, sectionId, marks, negativeMarks}`) consumed by
attempt creation — the attempt-creation code path does not know or care which
strategy produced the list.

## Evaluation Strategies

Per `question_type`, an evaluator determines `answer_status`
(`CORRECT`/`INCORRECT`/`UNANSWERED`) and marks awarded. V1 implements the
`MCQ_SINGLE` evaluator (compare `selected_option_id` to the version's correct
option). The registry pattern must allow adding `MCQ_MULTI`, `TRUE_FALSE`,
`NUMERIC`, `SHORT_TEXT` evaluators later without touching the submission
workflow itself.

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
