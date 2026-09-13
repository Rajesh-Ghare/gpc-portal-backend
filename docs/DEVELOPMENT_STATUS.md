# Development Status

## Current Phase

Phase 7 - Exam Engine / Attempt Lifecycle (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [x] Question bank
- [x] Test builder
- [x] Exam engine
- [ ] Results
- [ ] Commerce
- [ ] Payments
- [ ] AI
- [ ] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

("Exam engine" = attempt creation, selection, timer, autosave, submission,
evaluation, and per-attempt result retrieval. "Results" (next) = cross-
attempt aggregation — rank/percentile — and the admin result-release
workflow implied by `results.released_at`; see ADR-027.)

## Current Work

Phase 7 is complete and verified — including a minimal admin
entitlement-grant feature the project owner explicitly requested ahead of
Commerce, built as a real (not throwaway) slice of the commerce data model.
Awaiting user confirmation before starting Phase 8 (Results: rank/
percentile computation, admin result-release workflow, admin result
browsing).

## Completed (Phase 7, this session)

### Attempt engine

- **`POST /tests/:testId/attempts`**: validates test is `PUBLISHED` and
  within its availability window, resolves an active entitlement
  (`entitlementService.findActiveEntitlementForTest` — `INDIVIDUAL_TEST`/
  `EXAM_PACKAGE`/`TEST_SERIES`/blanket `SUBSCRIPTION`/`ALL_ACCESS`, not
  `SUBJECT_PACKAGE` — ADR-026), enforces `attemptPolicy=SINGLE` and the
  entitlement's `attemptLimit`/`attemptsUsed`, selects questions via the
  right strategy, and creates `attempts`+`attempt_questions` (+ increments
  `entitlements.attempts_used`) in **one transaction**. An existing
  `IN_PROGRESS` attempt is resumed (returned as-is), not treated as an
  error — verified this doesn't double-charge the entitlement.
- **Question selection strategies implemented**
  (`src/strategies/questionSelection/`): `ManualSelectionStrategy` (uses
  `test_questions` directly) and `RuleBasedSelectionStrategy` (randomly
  picks `question_count` approved+published questions per `test_rules` row,
  excluding questions already used by an earlier rule in the same attempt,
  tag-filtered "any of"). Both verified against the real database,
  including a rule-based attempt that correctly selected 2 distinct
  questions from the available pool.
- **`GET /attempts/:attemptId`**: safe attempt detail (never `is_correct`/
  `correct_option_id`), computed `remainingSeconds`, auto-submits first if
  expired.
- **`PUT /attempts/:attemptId/questions/:attemptQuestionId/answer`**:
  ownership + status + time + option-validity checks
  (`errorCode INVALID_OPTION` — its first real use since Phase 1),
  upserts `attempt_answers`.
- **`POST /attempts/:attemptId/submit`**: row-locked
  (`transaction.LOCK.UPDATE`), idempotent (resubmitting returns the
  identical result, doesn't recompute — verified), evaluates via
  `getEvaluator(questionType)` (`src/strategies/evaluation/` —
  `McqSingleEvaluator` implemented; any other type falls back to
  UNANSWERED/0 rather than crashing, see Known Issues), creates
  `results`+`result_details`. **Scoring hand-verified**: 1 correct (1.00),
  1 incorrect (−0.25), 2 unanswered → 18.75% / 50% accuracy, matched
  exactly.
- **`GET /attempts/:attemptId/result`**: shapes its response around the
  test's `show_score`/`show_correct_answers`/`show_rank`/`show_percentile`
  flags; `errorCode RESULT_NOT_RELEASED` if `result_visibility` isn't
  `IMMEDIATE` and nothing has released it yet (Phase 8 territory).
- **Backend-authoritative timer, verified with a real clock**: created a
  test with a 1–2 second duration, waited past expiry, and confirmed `GET
  /attempts/:id` transparently auto-submitted it (`auto_submitted=true`,
  a `results` row existed, unanswered questions scored 0) — the student
  never called `/submit`.
- **`GET /tests`, `GET /tests/:testId`** (public-to-authenticated-users test
  browsing, `testBrowseService.ts`): published tests only, within their
  availability window.
- **`attemptPolicy` (`src/policies/attemptPolicy.ts`)**: the first real
  implementation of the "policies" layer `docs/ARCHITECTURE.md` has
  described since Phase 1 — `ensureOwnsAttempt` checks data-scoped
  ownership, not a permission code, since a student has no `attempt.*`
  permission for their own records.

### Entitlement grant (explicitly requested by the project owner)

- **`POST /admin/entitlements`** (`entitlement.grant` permission, new this
  phase): grants a student access using the **real**
  `products`/`product_items`/`entitlements` tables — given a `testId`,
  finds-or-creates the minimal `INDIVIDUAL_TEST` product/product_item
  (reused across repeated grants for the same test); given a
  `productItemId`, grants directly (forward-compatible with Phase 9's real
  catalog). **Idempotent** (verified: granting twice returns the same
  entitlement, 200 not 201, no duplicate row). Audit-logged
  (`entitlement.grant` — the sixth spec-section-46 action now covered).
  See ADR-025 for the full reasoning (spec's own phase order puts Exam
  Engine before Commerce, and `docs/COMMERCE_AND_PAYMENTS.md` already
  documented admin overrides as a planned feature — this isn't new scope).
- `src/repositories/productRepository.ts` created narrow and deliberately
  incomplete — only what the grant flow needs; Phase 9 extends it.

### Two real bugs found by manual testing and fixed (see docs/DECISIONS.md ADR-028, docs/SECURITY.md)

1. **Security**: `createAttempt()`'s success response initially leaked
   `is_correct`/`correct_option_id` (it returned a raw eager-loaded query
   result instead of routing through the sanitizing serializer
   `getAttemptDetail()` uses). Caught by grepping the actual HTTP response
   during manual testing, not by type-checking. Fixed by making
   `createAttempt()` call `getAttemptDetail()` for its response — there is
   now exactly one code path that ever serializes attempt-question data for
   a student.
2. **Data integrity**: a 4-level-deep Sequelize `include` chain (attempt →
   attempt_questions → question_version → options → translations) produced
   column aliases longer than PostgreSQL's 63-byte identifier limit;
   Postgres silently truncated them (e.g. `questionOptionId` →
   `questionO`), so Sequelize mapped values onto wrong/mangled attribute
   names — the query succeeded but option text came back missing. Fixed
   with `separate: true` on the nested associations
   (`src/repositories/attemptRepository.ts`), which runs each as its own
   short-alias query instead. Recorded as ADR-028 since this failure mode
   is silent (no error thrown) and will recur in any future deeply-nested
   include if not watched for.

### Testing

- **5 new automated integration tests**
  (`tests/integration/attempt.test.ts`): entitlement-required rejection,
  the full grant→create→answer→ownership-enforcement→submit→idempotent-
  resubmit→result flow (including the is_correct-leak regression check),
  auto-submit-on-timer-expiry, SINGLE attempt policy enforcement, and —
  closing a long-open Known Issues item — **a direct test of the Phase 2
  partial unique index on `attempts`**, inserting two `IN_PROGRESS` rows
  for the same user/test via the model directly and asserting Postgres
  itself rejects the second (`SequelizeUniqueConstraintError`, Postgres
  code `23505`) — not just that the service layer's own pre-check would
  catch it.
- Seeder `20260913100009-entitlement-permissions.js` (`entitlement.grant`),
  run against dev + test databases.
- New error codes: `USER_NOT_FOUND`, `RESULT_NOT_RELEASED`.

## In Progress

Nothing — Phase 7 scope is complete.

## Blocked

None.

## Known Issues

New this phase (see `docs/KNOWN_ISSUES.md` for full detail): no
entitlement list/browse/revoke endpoint yet; `SUBJECT_PACKAGE` entitlements
grant no test access (no defined resolution rule); `rank`/`percentile`
always `null` (Phase 8); `randomize_options` not implemented; a few
Security Test Coverage checklist items are implied-but-not-separately-
tested. The `product_items` CHECK constraint (unlike the `attempts` partial
unique index, now tested) still has no automated test.

## Next Recommended Task

Phase 8: Results. Per spec sections 16/24: rank/percentile computation
across all `EVALUATED` results for a test (a cross-attempt aggregate —
decide whether this recomputes on every new submission or runs as a
periodic/on-demand batch job before implementing, since recomputing
everyone's rank on every single submission doesn't scale and going stale
between submissions is the realistic tradeoff), the admin result-release
workflow (`results.released_at`, permission `result.release` — already
seeded), and admin result browsing (`result.view` — already seeded,
`GET /admin/results` doesn't exist yet). This phase should also add the
still-missing `GET /admin/entitlements` (list/browse) and a revoke action
if Commerce work starts touching entitlements before Phase 9 proper
begins — otherwise leave that for Phase 9.

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 7 (Exam Engine): attempt creation with real
manual/rule-based question selection and snapshotting, backend-
authoritative timing with verified auto-submit-on-expiry, answer autosave,
transactional idempotent submission with hand-verified MCQ_SINGLE scoring,
and result retrieval respecting test visibility flags. Also built, at the
project owner's explicit request, a minimal but real admin
entitlement-grant endpoint (reusing the actual commerce tables) so the
whole flow is testable via the API today, not just via test fixtures —
ahead of Commerce (Phase 9) per the spec's own phase ordering. Manual
end-to-end testing caught and fixed two real bugs (a correctness-data
security leak, and a silent Postgres identifier-truncation data-corruption
bug from deeply nested Sequelize includes) that neither type-checking nor
a narrower unit test would have caught — both are now documented as ADRs
so they don't recur. Closed a long-open Known Issues item by adding a
direct database-level test of the `attempts` partial unique index.

## Important Files Changed

- `src/errors/errorCodes.ts` (modified — `USER_NOT_FOUND`, `RESULT_NOT_RELEASED`)
- `src/repositories/{attemptRepository.ts,entitlementRepository.ts,productRepository.ts}` (created)
- `src/repositories/questionRepository.ts` (modified — `countApprovedQuestions` reused by rule-based selection)
- `src/services/{attemptService.ts,entitlementService.ts,testBrowseService.ts}` (created)
- `src/policies/attemptPolicy.ts` (created)
- `src/strategies/questionSelection/{QuestionSelectionStrategy.ts,ManualSelectionStrategy.ts,RuleBasedSelectionStrategy.ts,index.ts}` (created)
- `src/strategies/evaluation/{Evaluator.ts,McqSingleEvaluator.ts,index.ts}` (created)
- `src/utils/shuffle.ts` (created)
- `src/validations/{attempt.validation.ts,entitlement.validation.ts}` (created)
- `src/controllers/{attemptController.ts,testBrowseController.ts,entitlementController.ts}` (created)
- `src/api/v1/routes/{student.routes.ts,entitlement.routes.ts}` (created)
- `src/app.ts` (modified — mounts new routers)
- `src/models/{Attempt.ts,AttemptQuestion.ts,QuestionVersion.ts,QuestionOption.ts,Test.ts,TestRule.ts}` (modified — association mixin types)
- `src/seeders/20260913100009-entitlement-permissions.js` (created, run against dev + test DBs)
- `tests/integration/attempt.test.ts` (created)
- `docs/EXAM_ENGINE.md` (rewritten for the as-built engine, including both
  bugs found), `docs/SECURITY.md` (bug documented, coverage checklist
  turned into a checked/unchecked list), `docs/API.md` (student + admin
  entitlement endpoints documented), `docs/AUTHENTICATION.md` (permission +
  policy-layer updates), `docs/COMMERCE_AND_PAYMENTS.md` (entitlement
  resolution + admin override sections marked implemented),
  `docs/DECISIONS.md` (ADR-025 through ADR-028)

## Database Changes

None (no migrations) — Phase 7 used the existing `attempts`,
`attempt_questions`, `attempt_answers`, `results`, `result_details`,
`entitlements`, `products`, `product_items` tables from Phase 2 as-is,
plus 1 new `permissions` row (`entitlement.grant`) via a seeder.

## API Changes

Added (see `docs/API.md` for full request/response shapes):
- `GET /tests`, `GET /tests/:testId` (public-to-authenticated-users)
- `POST /tests/:testId/attempts`
- `GET /attempts/:attemptId`
- `PUT /attempts/:attemptId/questions/:attemptQuestionId/answer`
- `POST /attempts/:attemptId/submit`
- `GET /attempts/:attemptId/result`
- `POST /admin/entitlements`

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (Phase 4).
- `tests/integration/questionBank.test.ts` — 7 tests (Phase 5).
- `tests/integration/testBuilder.test.ts` — 5 tests (Phase 6).
- `tests/integration/attempt.test.ts` — 5 tests (this phase).
- Total: 29 tests, all passing against the real test database.
- Still open: the `product_items` CHECK constraint has no automated test
  (the `attempts` partial unique index now does — see Known Issues).

## Handover Notes

- **Any new endpoint that returns attempt-question data must reuse
  `getAttemptDetail()`'s serialization, never eager-load-and-return
  directly.** This is the exact bug Phase 7 shipped and then caught —
  don't reintroduce it in Phase 8+ (e.g. an admin "view a student's
  attempt" endpoint must build its own explicit view, deciding what an
  admin is allowed to see, rather than copy-pasting the student path).
- **Any Sequelize `include` 4+ levels deep needs `separate: true`
  somewhere in the chain**, or column aliases silently truncate past
  Postgres's 63-byte identifier limit and data comes back under the wrong
  field name with no error. See ADR-028 before adding new deep includes
  (results with nested question/option data in Phase 8 is a likely place
  this recurs).
- The entitlement-grant endpoint is real infrastructure, not a testing
  shortcut — Phase 9 should extend `productRepository.ts`/
  `entitlementService.ts`, not replace them with a parallel
  order/payment-driven path.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
