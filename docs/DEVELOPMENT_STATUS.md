# Development Status

## Current Phase

Phase 6 - Test Builder (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [x] Question bank
- [x] Test builder
- [ ] Exam engine
- [ ] Results
- [ ] Commerce
- [ ] Payments
- [ ] AI
- [ ] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

("Test builder" = assembling a test's structure and lifecycle
(create/sections/manual-questions/rules/validate/publish/close/archive).
"Exam engine" (next) = actually *running* an attempt against that
structure — resolving `RULE_BASED` rules into a frozen question set,
timing, autosave, submission. `validateTest()` already checks a rule's
satisfiability; it does not select/freeze questions — that's Phase 7.)

## Current Work

Phase 6 is complete and verified. Awaiting user confirmation before starting
Phase 7 (Exam Engine / Attempt lifecycle: attempt creation with
manual/rule-based question selection and snapshotting, answer autosave,
backend-authoritative timer, transactional idempotent submission,
evaluation).

## Completed (Phase 6, this session)

- **Full test CRUD** (`src/services/testService.ts`): create/get/list/
  update/delete for `tests`, validating `competitiveExamId`/`testSeriesId`
  exist, with slug auto-generation/uniqueness (same pattern as catalog).
- **Test lifecycle**: `DRAFT → PUBLISHED → CLOSED → ARCHIVED`
  (`publishTest`/`closeTest`/`archiveTest`), each enforcing the correct
  *from* status (`TEST_INVALID_STATUS_TRANSITION` otherwise, 409).
- **`ensureTestEditable()`**: a test's sections/manual questions/rules/basic
  info can only be created/updated/deleted while `status=DRAFT`
  (`TEST_NOT_EDITABLE`, 409) — ADR-024. No live attempts exist yet to
  protect, but this closes the gap before Phase 7 needs it.
- **Test validation engine** (`validateTest()`): for `MANUAL` tests, checks
  at least one `test_questions` row exists; for `RULE_BASED` tests, checks
  at least one `test_rules` row exists **and** that each rule's filter
  (subject/topic/type/difficulty/tags) actually has enough
  `PUBLISHED`+`APPROVED` questions to satisfy `question_count`
  (`questionRepository.countApprovedQuestions()`, tag-filtered "any of").
  Also computes `totalQuestions`/`totalMarks` from the real assembled
  content. `GET /admin/tests/:id/validate` exposes this without mutating
  anything; `publishTest()` calls it and **persists** the computed totals on
  success (ADR-024) rather than trusting an admin-entered value.
- **Test sections CRUD**, hard-deleted (matches the schema — `test_sections`
  has no `deleted_at`).
- **Manual test-question assignment** (`test_questions`): the first real use
  of the `QUESTION_NOT_APPROVED` error code (defined since Phase 1, unused
  until now) — adding a question whose `reviewStatus !== 'APPROVED'` is
  rejected. `questionVersionId` defaults to the question's latest version;
  `marks`/`negativeMarks` default to that version's own values, falling back
  further to the test's `defaultMarksPerQuestion`/`defaultNegativeMarks`.
  Duplicate question-in-test is rejected before hitting the DB's unique
  constraint, for a cleaner error.
- **Test rules CRUD** (`test_rules` + `test_rule_tags`), including inline
  tag find-or-create (same pattern as question tags — ADR-022).
- **`audit_logs` extended to `test.publish`/`test.close`**
  (`test.archive` deliberately excluded — not on spec section 46's list;
  see ADR-024) — the fifth and sixth audit-logged action types overall.
- Added `setTags`/`tags` mixin types to `TestRule` (same pattern as
  `Question` in Phase 5) and `sections`/`testQuestions`/`testRules`
  `NonAttribute` declarations to `Test` (needed for `validateTest()` to read
  eager-loaded associations with type safety instead of `.get()`).
- 2 new error codes: `TEST_NOT_EDITABLE`, `TEST_INVALID_STATUS_TRANSITION`.
- No new permission seeder needed — `test.view`/`create`/`update`/
  `validate`/`publish`/`close` were already seeded in Phase 1's baseline
  list and simply went unused until this phase wired them to real routes
  (same story as `question.*` in Phase 5).
- **Verified manually against a real running server + PostgreSQL 17**: full
  create → validate-fails-empty → publish-fails-validation → add section +
  approved question → validate-passes → publish (totals computed) →
  edit-blocked-while-published → close → archive flow; confirmed
  `QUESTION_NOT_APPROVED` rejection for an unapproved question; confirmed a
  `RULE_BASED` test's validation correctly detects an unsatisfiable rule
  (100 requested, 4 available) and passes once the count is lowered to what
  the real approved-question pool can supply.
- **5 new automated integration tests**
  (`tests/integration/testBuilder.test.ts`): STUDENT rejection, empty-test
  validation/publish failure, unapproved-question rejection, the full
  publish→edit-blocked→close→archive flow (asserting both status
  transitions and the `audit_logs` rows for publish/close), and
  `RULE_BASED` validation against the real question pool (fails at 5
  required/1 available, passes after lowering to 1).

## In Progress

Nothing — Phase 6 scope is complete.

## Blocked

None.

## Known Issues

None new — see `docs/KNOWN_ISSUES.md` for what's still open (Phase 2 DB
constraint tests, non-MCQ_SINGLE validation, no tag browse endpoint).

## Next Recommended Task

Phase 7: Exam Engine (attempt lifecycle). Per spec sections 15/26–30:
- Attempt creation: validate auth + entitlement (entitlements don't exist as
  a concept with real data yet — Phase 9/10 — so this check will need a
  temporary bypass or a note that it's incomplete until commerce exists;
  decide which explicitly rather than silently skipping it) + test status/
  schedule + attempt policy/limits + question availability, then create
  `attempts` + `attempt_questions` in one transaction (ADR-008 snapshot:
  question_id/question_version_id/order/marks frozen at this moment).
- For `RULE_BASED` tests, this is where `countApprovedQuestions()` needs a
  sibling that actually *selects* (not just counts) matching questions per
  rule's `selection_strategy` — the concrete `ManualSelectionStrategy`/
  `RuleBasedSelectionStrategy` from `docs/EXAM_ENGINE.md` that this phase
  left as "planned."
- Backend-authoritative timer (`started_at`/`expires_at`).
- Answer autosave endpoint (`attempt_answers` upsert).
- Transactional, idempotent submission + evaluation (`MCQ_SINGLE` evaluator
  first, matching what's actually buildable today) + `results`/
  `result_details` creation.
- This phase will make real use of the partial unique index on `attempts`
  (one `IN_PROGRESS` attempt per user/test) from Phase 2 — a good moment to
  also close the long-open Known Issues item about the DB constraints never
  having an automated test, since this phase will be exercising that exact
  constraint under test anyway.

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 6 (Test Builder): full test CRUD and
lifecycle (DRAFT→PUBLISHED→CLOSED→ARCHIVED), a validation engine that
checks both MANUAL (has questions) and RULE_BASED (rules satisfiable against
the real approved-question pool) tests before allowing publish and persists
the computed totals, sections/manual-question-assignment/rules CRUD, and a
DRAFT-only editability rule (ADR-024) that closes a snapshot-safety gap
ahead of Phase 7 needing it. This was the first real use of
`QUESTION_NOT_APPROVED` (defined since Phase 1) and extended `audit_logs` to
`test.publish`/`test.close`.

## Important Files Changed

- `src/errors/errorCodes.ts` (modified — `TEST_NOT_EDITABLE`, `TEST_INVALID_STATUS_TRANSITION`)
- `src/repositories/{testRepository.ts,testSectionRepository.ts,testQuestionRepository.ts,testRuleRepository.ts}` (created)
- `src/repositories/questionRepository.ts` (modified — `countApprovedQuestions`)
- `src/services/{testService.ts,testSectionService.ts,testQuestionService.ts,testRuleService.ts}` (created)
- `src/validations/testBuilder.validation.ts` (created)
- `src/controllers/testBuilderController.ts` (created)
- `src/api/v1/routes/testBuilder.routes.ts` (created)
- `src/app.ts` (modified — mounts `testBuilderRouter`)
- `src/models/{Test.ts,TestRule.ts}` (modified — association mixin types)
- `tests/integration/testBuilder.test.ts` (created)
- `docs/API.md` (test builder endpoints documented), `docs/AUTHENTICATION.md`
  (permission list updated), `docs/DECISIONS.md` (ADR-024), `docs/SECURITY.md`
  (Auditability — test.publish/close added), `docs/EXAM_ENGINE.md`
  (Question Selection Strategies section — status clarified: admin-side
  setup done, attempt-time selection still planned)

## Database Changes

None (no migrations) — Phase 6 used the existing `tests`, `test_sections`,
`test_questions`, `test_rules`, `test_rule_tags` tables from Phase 2 as-is.

## API Changes

Added (see `docs/API.md` for full request/response shapes), all under
`/api/v1/admin`:
- `GET/POST /tests`, `GET/PUT/DELETE /tests/:testId`
- `GET /tests/:testId/validate`, `POST /tests/:testId/{publish,close,archive}`
- `GET/POST /tests/:testId/sections`, `PUT/DELETE /tests/:testId/sections/:id`
- `GET/POST /tests/:testId/questions`, `DELETE /tests/:testId/questions/:id`
- `GET/POST /tests/:testId/rules`, `PUT/DELETE /tests/:testId/rules/:id`

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (Phase 4).
- `tests/integration/questionBank.test.ts` — 7 tests (Phase 5).
- `tests/integration/testBuilder.test.ts` — 5 tests (this phase).
- Total: 24 tests, all passing against the real test database (sequential —
  see Phase 5's `fileParallelism: false` note, still in effect).
- Still open: no automated test for the Phase 2 DB constraints themselves —
  Phase 7 is a natural place to close this (see Next Recommended Task).

## Handover Notes

- **A test can only be structurally edited while `DRAFT`.** This applies to
  its own basic-info fields too, not just sections/questions/rules — there
  is currently no way to fix a typo in a `PUBLISHED` test's title without
  closing/archiving it and starting over. If that proves too restrictive in
  practice, add a narrower "edit non-structural fields" path rather than
  loosening `ensureTestEditable()` globally (see ADR-024's Consequences).
- `publishTest()` **overwrites** `total_questions`/`total_marks` with
  computed values — don't rely on whatever was set at test creation time
  surviving to publish; it won't.
- Test archive is intentionally not audit-logged and reuses `test.close`'s
  permission — don't "fix" either of these without checking ADR-024 and
  spec section 46/25 first.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
