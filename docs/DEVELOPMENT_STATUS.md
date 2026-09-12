# Development Status

## Current Phase

Phase 4 - Exam Catalog (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [ ] Question bank
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

("Exam catalog" here means admin CRUD for `exam_categories`,
`competitive_exams`, `test_series` — their **schema** existed since Phase 2;
this phase added the services/controllers/routes/permissions. `tests`/
`test_sections` themselves belong to "Test builder", a later phase.)

## Current Work

Phase 4 is complete and verified. Awaiting user confirmation before starting
Phase 5 (Question Bank: admin CRUD for subjects, topics, questions,
question versions/translations/options, question review workflow).

## Completed (Phase 4, this session)

- **Admin CRUD for the exam catalog hierarchy** (categories → exams →
  series), permission-gated with a new shared `catalog.*` permission family
  (`catalog.view`/`create`/`update`/`delete` — ADR-021, chosen over a
  code-per-table scheme since the spec groups these three tables under one
  "EXAM CATALOG" section and they're typically managed by the same admin).
- **15 routes** under `/api/v1/admin` (`src/api/v1/routes/catalog.routes.ts`):
  full list/get/create/update/delete for `/categories`, `/exams`, `/series`.
  See `docs/API.md` for request/response shapes.
- **Repository + service + controller layers** for each entity
  (`examCategoryRepository`/`Service`, `competitiveExamRepository`/`Service`,
  `testSeriesRepository`/`Service`, grouped into one `catalogController.ts`)
  — three parallel, mostly-similar implementations rather than a premature
  generic CRUD abstraction, since each entity's validation already diverges
  (exams validate `categoryId` exists; series optionally validate
  `competitiveExamId`).
- **Slug handling**: a small `slugify()` util auto-generates a slug from
  `name` when omitted; each service checks slug uniqueness itself before
  insert/update and returns a clean `DUPLICATE_SLUG` (409) rather than
  letting a raw Postgres unique-constraint error leak to the client.
- **FK validation before insert**: creating an exam with a nonexistent
  `categoryId` (or a series with a nonexistent `competitiveExamId`) returns
  `CATEGORY_NOT_FOUND`/`EXAM_NOT_FOUND` (404) rather than a DB-level FK
  violation.
- **`requirePermission` finally exercised for real** (it existed since
  Phase 3 but had never protected an actual route): every catalog route
  requires `authenticate` + the relevant `catalog.*` permission. Verified
  both directions — SUPER_ADMIN succeeds, STUDENT gets `FORBIDDEN` — closing
  the Known Issues gap flagged in Phase 3.
- New seeder `20260913100007-catalog-permissions.js` adds the 4 `catalog.*`
  permissions and grants them to SUPER_ADMIN/ADMIN; run against both the
  development and test databases this session.
- 4 new error codes: `CATEGORY_NOT_FOUND`, `EXAM_NOT_FOUND`,
  `SERIES_NOT_FOUND`, `DUPLICATE_SLUG`.
- Added `requireParam(req, name)` (`src/utils/params.ts`) — Express 5 types
  route params as `string | string[] | undefined` to account for wildcard
  segments; this asserts the common single-string case cleanly instead of
  scattering `as string` casts.
- Added Sequelize `getRoles`/`addRole` mixin types were already on `User`
  (Phase 3); no model changes needed this phase — the catalog models
  (`ExamCategory`, `CompetitiveExam`, `TestSeries`) already had everything
  needed from Phase 2.
- **Verified manually against a real running server + PostgreSQL 17**: full
  create → list → duplicate-slug-rejected → FK-validated-exam-creation →
  soft-delete → 404-after-delete flow, logged in as the seeded SUPER_ADMIN;
  confirmed a STUDENT gets 403 on every catalog route.
- **6 new automated integration tests** (`tests/integration/catalog.test.ts`,
  run against the real test database): unauthenticated rejection, STUDENT
  FORBIDDEN rejection, category creation with auto-slug, duplicate-slug
  rejection, exam creation with FK validation (both success and
  `CATEGORY_NOT_FOUND` paths), and soft-delete behavior (404 via the API,
  row still present with `deleted_at` set when queried with
  `paranoid: false`).

## In Progress

Nothing — Phase 4 scope is complete.

## Blocked

None.

## Known Issues

None new — the Phase 3 `requirePermission`-is-untested item is now resolved
and removed from `docs/KNOWN_ISSUES.md`. The Phase 2 DB-constraint-testing
gap is still open.

## Next Recommended Task

Phase 5: Question Bank (admin CRUD). Per spec sections 13/24: subjects,
topics (nested — watch the `(subject_id, slug)` uniqueness scope from
`docs/DATABASE.md`), questions (with versioning), question review workflow
(`review_status`: PENDING → APPROVED/REJECTED, permission `question.approve`/
`question.reject` — already seeded), question_versions/translations/options/
option_translations, tags. This is a materially bigger phase than catalog:
question creation needs to atomically create a `questions` row +
`question_versions` row + `question_translations` row(s) +
`question_options` rows (+ their translations) — decide whether that's one
service method wrapped in a transaction (recommended) before writing it.

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 4 (Exam Catalog admin CRUD) end to end:
categories/exams/series CRUD with slug auto-generation, FK validation, and
soft-delete, gated by a new `catalog.*` permission family (ADR-021). This
was the first phase to actually exercise `requirePermission` (implemented
but unused since Phase 3) — verified via both manual testing and 6 new
integration tests that it correctly allows SUPER_ADMIN and rejects STUDENT.

## Important Files Changed

- `src/errors/errorCodes.ts` (modified — 4 new codes)
- `src/utils/{slugify.ts,params.ts}` (created)
- `src/repositories/{examCategoryRepository.ts,competitiveExamRepository.ts,testSeriesRepository.ts}` (created)
- `src/services/{examCategoryService.ts,competitiveExamService.ts,testSeriesService.ts}` (created)
- `src/validations/catalog.validation.ts` (created)
- `src/controllers/catalogController.ts` (created)
- `src/api/v1/routes/catalog.routes.ts` (created)
- `src/app.ts` (modified — mounts `catalogRouter` at `/admin`)
- `src/seeders/20260913100007-catalog-permissions.js` (created, run against
  dev + test DBs)
- `tests/integration/catalog.test.ts` (created)
- `docs/API.md` (admin catalog endpoints documented), `docs/AUTHENTICATION.md`
  (permission list updated, `requirePermission` marked verified),
  `docs/DECISIONS.md` (ADR-021), `docs/KNOWN_ISSUES.md` (resolved item
  removed)

## Database Changes

None (no migrations) — Phase 4 used the existing `exam_categories`,
`competitive_exams`, `test_series` tables from Phase 2 as-is, and added 4
rows to `permissions` + corresponding `role_permissions` rows via a new
seeder (not a migration, since permissions are seed data, not schema).

## API Changes

Added (see `docs/API.md` for full request/response shapes), all under
`/api/v1/admin`, all requiring auth + a `catalog.*` permission:
- `GET/POST /categories`, `GET/PUT/DELETE /categories/:id`
- `GET/POST /exams`, `GET/PUT/DELETE /exams/:id` (list supports
  `?categoryId=`)
- `GET/POST /series`, `GET/PUT/DELETE /series/:id` (list supports
  `?competitiveExamId=`)

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (this phase): auth
  rejection, permission rejection, create-with-auto-slug, duplicate-slug
  rejection, FK validation (exam→category), soft-delete behavior.
- Total: 12 tests, all passing against the real test database.
- Still open: no automated test for the Phase 2 DB constraints themselves
  (see `docs/KNOWN_ISSUES.md`).

## Handover Notes

- The `catalog.*` permission family (not `category.*`/`exam.*`/`series.*`)
  is the established pattern for this hierarchy — see ADR-021 before adding
  new permission codes for anything under exam catalog.
- Soft-delete is the only delete behavior for catalog entities — there is no
  hard-delete endpoint, and none should be added without a specific reason
  (audit/compliance requirement) and a new ADR, since it would bypass the
  history-preservation intent of `paranoid: true`.
- `docs/DEVELOPMENT_STATUS.md`'s own "Next Recommended Task" from Phase 3
  flagged this exact permission-scheme decision in advance — worth doing
  that same look-ahead at the end of this phase too (see Next Recommended
  Task above re: question-creation transaction design).
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
