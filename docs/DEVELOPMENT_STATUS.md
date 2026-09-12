# Development Status

## Current Phase

Phase 5 - Question Bank (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [x] Question bank
- [ ] Test builder
- [ ] Exam engine
- [ ] Results
- [ ] Commerce
- [ ] Payments
- [ ] AI
- [ ] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

("Question bank" here means admin CRUD for `subjects`/`topics`, the
transactional question-authoring + versioning workflow, and the
approve/reject review workflow. Assembling questions *into a test*
—`test_questions`/`test_rules`— is "Test builder", the next phase.)

## Current Work

Phase 5 is complete and verified. Awaiting user confirmation before starting
Phase 6 (Test Builder: admin test CRUD, sections, manual + rule-based
question selection, test validation, publish/close).

## Completed (Phase 5, this session)

- **Subjects & topics admin CRUD** (`subjectService`/`topicService`,
  `/admin/subjects`, `/admin/topics`), gated by a new `subject.*` permission
  family (ADR-022 — same "one family per nested hierarchy" pattern as
  ADR-021). Topic creation/update validates `parentTopicId` belongs to the
  same `subjectId`.
- **Transactional question authoring**
  (`src/services/questionService.ts`): `POST /admin/questions` creates a
  `questions` row + its first `question_versions` row + N
  `question_translations` + N `question_options` (+ their
  `question_option_translations`) + tag associations, **all inside one
  `sequelize.transaction()`** — verified against the real database with a
  4-option, 2-language-ready, 2-tag payload.
- **Question versioning, not in-place editing** (ADR-023): editing a
  question's *content* (`POST /admin/questions/:id/versions`) always creates
  a new `question_versions` row and bumps `questions.version`, preserving
  ADR-007/ADR-008's guarantee that an attempt's frozen `question_version_id`
  never changes underneath it. Editing *metadata* (`PUT
  /admin/questions/:id` — subject/topic/type/difficulty/tags) updates the
  `questions` row in place with no new version, since attempts never
  reference those fields directly.
- **MCQ_SINGLE domain validation**: exactly one correct option required (at
  least 2 options), enforced in the service before any write, returning
  `QUESTION_VERSION_INVALID` — verified both that it rejects 0-correct and
  2-correct payloads and that it doesn't block other question types (V1
  scope per spec section 42; stricter rules for other types are future
  work — see `docs/KNOWN_ISSUES.md`).
- **Review workflow**: `POST /admin/questions/:id/approve` (→
  `reviewStatus=APPROVED`, `status=PUBLISHED`) and `.../reject` (→
  `reviewStatus=REJECTED`, optional `reason`), gated by the existing seeded
  `question.approve`/`question.reject` permissions.
- **`audit_logs` actually populated for the first time**
  (`src/services/auditLogService.ts`): `question.approve`,
  `question.reject`, and `question.version_created` each write a row with
  actor/before/after/IP/user-agent, per spec section 46's explicit list —
  and *only* those three actions; metadata edits and catalog/subject/topic
  CRUD are deliberately not audited (not on the spec's list). Verified both
  manually (`SELECT * FROM audit_logs`) and via an integration test
  asserting the row exists after approval.
- **Tags have no standalone admin API** (ADR-022): managed inline via a
  `tags: string[]` array on question create/update, find-or-created by name
  inside the same transaction (`src/repositories/tagRepository.ts`) — matches
  spec section 24's admin-module list, which doesn't mention tags at all.
- 2 new error codes: `SUBJECT_NOT_FOUND`, `TOPIC_NOT_FOUND`.
- New seeder `20260913100008-subject-permissions.js` (4 `subject.*` codes,
  granted to SUPER_ADMIN/ADMIN); run against dev + test databases.
- Added `setTags`/`tags` Sequelize association mixin types to `Question`
  (same pattern as Phase 3's `User`/`Role` mixins — needed to call
  `question.setTags()` with type safety).
- **Verified manually against a real running server + PostgreSQL 17**: full
  subject → topic → question (4 options, 2 tags) → reject-invalid-MCQ →
  approve → new-version → audit-log-present flow, logged in as the seeded
  SUPER_ADMIN; confirmed a STUDENT gets 403 on every question-bank route.
- **7 new automated integration tests**
  (`tests/integration/questionBank.test.ts`): STUDENT rejection, 0-correct-
  option rejection, full transactional creation (asserts the nested
  question+version+options+tags shape), nonexistent-subject rejection,
  new-version creation (asserts version bump), approve (asserts the
  `audit_logs` row), and STUDENT-cannot-approve.
- **Fixed a test-suite race condition** discovered while running the full
  suite: `auth.test.ts`, `catalog.test.ts`, and `questionBank.test.ts` all
  log in as the same seeded users against one real shared test database;
  running test *files* in parallel let one file's OTP request race
  another's "find the latest active OTP request" lookup. Set
  `fileParallelism: false` in `vitest.config.mts` — this suite is small
  enough that sequential execution costs little, and it's a more honest fix
  than giving every file its own throwaway user just to dodge the race.

## In Progress

Nothing — Phase 5 scope is complete.

## Blocked

None.

## Known Issues

None new from this phase directly, but see `docs/KNOWN_ISSUES.md` for a new
entry: MCQ_SINGLE is the only question type with real domain validation;
MCQ_MULTI/TRUE_FALSE/NUMERIC/etc. accept any option shape for now (V1 scope,
spec section 42). The Phase 2 DB-constraint-testing gap is still open.

## Next Recommended Task

Phase 6: Test Builder. Per spec sections 12/14/38: `tests` + `test_sections`
CRUD, `test_questions` (manual selection) and `test_rules` (+
`test_rule_tags`, rule-based selection), test validation (a test must not be
publishable if e.g. it has zero questions, or a rule can't be satisfied by
the available approved-question pool), and publish/close lifecycle
transitions (`DRAFT → PUBLISHED → CLOSED → ARCHIVED`, per spec section 12).
This phase's test *creation* only assembles a manually- or rule-defined
question list — it does not evaluate rules at attempt time (that's Phase 7's
attempt-creation transaction, per ADR-010). Test publish/close are two of
the spec-section-46 audit-logged actions — wire up `auditLogService` for
those the same way this phase did for questions. Decide test validation's
exact rule set (what specifically blocks a publish) before writing it; it's
not fully spelled out in the spec beyond "must not allow an invalid test to
publish."

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 5 (Question Bank) end to end: subjects/topics
CRUD, a transactional question-authoring service that atomically creates a
question with its first version/translations/options/tags, a versioning
model where content edits always create a new version while metadata edits
stay in place (ADR-023), MCQ_SINGLE correct-option-count validation, and the
approve/reject review workflow — the first real use of `audit_logs`
(ADR/spec section 46). Also fixed a test-suite race condition (shared seeded
users + parallel test files) discovered while running the full suite after
adding this phase's tests.

## Important Files Changed

- `src/errors/errorCodes.ts` (modified — `SUBJECT_NOT_FOUND`, `TOPIC_NOT_FOUND`)
- `src/repositories/{subjectRepository.ts,topicRepository.ts,tagRepository.ts,questionRepository.ts}` (created)
- `src/services/{subjectService.ts,topicService.ts,questionService.ts,auditLogService.ts}` (created)
- `src/validations/{subject.validation.ts,question.validation.ts}` (created)
- `src/controllers/questionBankController.ts` (created)
- `src/api/v1/routes/questionBank.routes.ts` (created)
- `src/app.ts` (modified — mounts `questionBankRouter`)
- `src/models/Question.ts` (modified — `setTags`/`tags` mixin types)
- `src/seeders/20260913100008-subject-permissions.js` (created, run against dev + test DBs)
- `vitest.config.mts` (modified — `fileParallelism: false`)
- `tests/integration/questionBank.test.ts` (created)
- `docs/API.md` (question bank endpoints documented), `docs/AUTHENTICATION.md`
  (permission list updated), `docs/DECISIONS.md` (ADR-022, ADR-023),
  `docs/SECURITY.md` (Auditability section — now implemented, scope noted)

## Database Changes

None (no migrations) — Phase 5 used the existing `subjects`, `topics`,
`questions`, `question_versions`, `question_translations`,
`question_options`, `question_option_translations`, `tags`, `question_tags`,
and `audit_logs` tables from Phase 2 as-is, plus 4 new `permissions` rows
(`subject.*`) via a seeder.

## API Changes

Added (see `docs/API.md` for full request/response shapes), all under
`/api/v1/admin`:
- `GET/POST /subjects`, `GET/PUT/DELETE /subjects/:id`
- `GET/POST /topics` (list supports `?subjectId=`), `GET/PUT/DELETE /topics/:id`
- `GET/POST /questions` (list supports `?subjectId=&topicId=&status=&reviewStatus=`),
  `GET/PUT/DELETE /questions/:id`
- `POST /questions/:id/versions`, `POST /questions/:id/approve`,
  `POST /questions/:id/reject`

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (Phase 4).
- `tests/integration/questionBank.test.ts` — 7 tests (this phase).
- Total: 19 tests, all passing against the real test database (now run
  sequentially — see `fileParallelism: false` above).
- Still open: no automated test for the Phase 2 DB constraints themselves
  (see `docs/KNOWN_ISSUES.md`).

## Handover Notes

- **Two different endpoints edit a question — know which one to call.**
  `PUT /admin/questions/:id` is metadata-only (no new version). `POST
  /admin/questions/:id/versions` is a content edit (new version, audit
  logged). Calling the wrong one either silently fails to version content
  changes, or needlessly versions a subject re-file. See ADR-023.
- Tags have no admin list/browse endpoint — they only exist as a side effect
  of question authoring. If a future admin UI needs a tag picker, it'll need
  to either add a `GET /admin/tags` endpoint or infer the list from existing
  questions.
- `audit_logs` usage is intentionally scoped to exactly the actions spec
  section 46 lists — don't add audit calls "for consistency" to routes not
  on that list without checking it first.
- All integration test files now run sequentially
  (`vitest.config.mts` → `fileParallelism: false`) because they share one
  real test database and log in as the same seeded users. If a future test
  file needs true isolation, prefer giving it dedicated throwaway
  mobile numbers over re-enabling parallelism.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
