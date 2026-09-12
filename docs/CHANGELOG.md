# Changelog

## Unreleased

### Added

- Initial repository structure: `backend/` (Node.js + Express + TypeScript +
  Sequelize) and `frontend/` (React + Vite + TypeScript).
- Full `docs/` documentation system and root `CLAUDE.md`.
- Backend TypeScript, ESLint, and Prettier configuration.
- Backend `.env.example` and frontend `.env.example`.
- Sequelize CLI configuration (`.sequelizerc`) and empty
  `migrations/`/`seeders/` directories, ready for Phase 2.
- Git repository initialized.
- Express app bootstrap with helmet/cors/morgan, standard response envelope,
  centralized error-code catalog and error-handling middleware, `/health`
  check, and `/api/v1` router mount.
- Backend smoke test (Vitest + Supertest) verifying `/health`.
- Frontend feature-module directory skeleton
  (`app/components/features/hooks/services/stores/questionTypes/utils/
  constants/validations/permissions`) and added `react-router-dom`,
  `@tanstack/react-query`, `zustand`, `axios`.
- Full database schema: 43 migrations (pgcrypto + 41 tables + one deferred
  FK) covering auth, exam catalog, question bank, test assembly, attempt
  engine, results, commerce, AI, and system domains. Verified via a full
  `migrate:undo:all` + `migrate` round trip against a real PostgreSQL
  database.
- 41 corresponding TypeScript Sequelize models (`src/models/`) with full
  associations wired in `src/models/index.ts`.
- A partial unique index preventing more than one `IN_PROGRESS` attempt per
  user/test, and a `CHECK` constraint on `product_items` enforcing the
  correct target column for each `access_type` — both verified against the
  real database, not just written.
- 6 development seeders providing roles/permissions, 3 sample users
  (SUPER_ADMIN/ADMIN/STUDENT), SSC/SSC CGL catalog data, Quantitative
  Aptitude subject/topics, 4 sample questions, 1 sample test, and 1 sample
  product — all with working `down()` migrations.
- Split `tsconfig.json` into a type-checking config (includes tests) and
  `tsconfig.build.json` (production build, `src/` only), fixing a latent
  `rootDir` conflict from Phase 1 that `tsc -p tsconfig.json` would have hit.
- Mobile OTP authentication: `OtpProvider`/`MockOtpProvider`, `authService`
  (request/verify OTP, find-or-create user with default STUDENT role, opaque
  SHA-256-hashed session tokens), `authenticate`/`requirePermission`
  middleware, and the `POST /auth/request-otp`, `POST /auth/verify-otp`,
  `GET /auth/me`, `POST /auth/logout` routes. Verified manually against a
  live server/database (including exhausting the OTP attempt limit) and via
  5 new automated integration tests.
- Exam catalog admin CRUD: 15 routes under `/api/v1/admin` for categories,
  competitive exams, and test series, gated by a new `catalog.*` permission
  family (view/create/update/delete). Includes slug auto-generation,
  duplicate-slug rejection, FK validation (exam→category, series→exam), and
  soft-delete. First real use of the `requirePermission` middleware
  (implemented in Phase 3, unused until now) — verified both directions via
  6 new integration tests.
- Question bank admin CRUD: subjects/topics (`subject.*` permission family,
  ADR-022), and a transactional question-authoring service that atomically
  creates a question with its first version, translations, options, and
  tags. Editing a question's content always creates a new version rather
  than mutating one in place (ADR-023), preserving the guarantee that a
  student's in-progress/completed attempt never sees content change
  underneath it. MCQ_SINGLE options are validated (exactly one correct
  option). Approve/reject review workflow. First real use of `audit_logs`
  (`question.approve`/`.reject`/`.version_created`, per spec section 46).
  Verified manually and via 7 new integration tests.
- Test builder admin CRUD: full test lifecycle
  (DRAFT→PUBLISHED→CLOSED→ARCHIVED), sections, manual `test_questions`
  assignment (rejects unapproved questions — first real use of
  `QUESTION_NOT_APPROVED`), and `test_rules`/`test_rule_tags` (rule-based
  selection config). A test's structure is only editable while `DRAFT`
  (ADR-024). `validateTest()` checks MANUAL tests have questions and
  RULE_BASED tests' rules are actually satisfiable against the real
  approved-question pool; `publishTest()` runs it and persists the computed
  totals. Extends `audit_logs` to `test.publish`/`test.close`. Verified
  manually and via 5 new integration tests.

### Changed

- Split the project into two separate git repositories, `gpc-portal-backend`
  (this repo — now also owns the full `docs/`/`CLAUDE.md`) and
  `gpc-portal-frontend`, rather than one monorepo (ADR-016). `docs/`,
  `CLAUDE.md`, and the root `README.md` moved from the shared parent folder
  into this repo; `gpc-portal-frontend` got its own short README pointing
  back here.
- `src/config/env.ts` now appends `_test` to the database name under
  `NODE_ENV=test`, matching `sequelize-cli.js`'s existing behavior — the app
  and the CLI were previously inconsistent about which database
  `NODE_ENV=test` pointed at.
- Integration tests now run sequentially (`vitest.config.mts` →
  `fileParallelism: false`), fixing a race where test files sharing one real
  database and the same seeded users could grab each other's OTP requests.

### Fixed

(none)

### Security

(none)

### Database

- Full schema implemented: 41 tables + `pgcrypto` extension. See
  `docs/DATABASE.md` for the complete migration list and integrity rules.

### Documentation

- Created `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`,
  `docs/DATABASE.md`, `docs/API.md`, `docs/FRONTEND.md`,
  `docs/EXAM_ENGINE.md`, `docs/AUTHENTICATION.md`,
  `docs/COMMERCE_AND_PAYMENTS.md`, `docs/AI.md`, `docs/SECURITY.md`,
  `docs/DEPLOYMENT.md`, `docs/TESTING.md`, `docs/DECISIONS.md`
  (ADR-001 through ADR-024), `docs/KNOWN_ISSUES.md`,
  `docs/DEVELOPMENT_STATUS.md`, and root `CLAUDE.md`.
- `docs/DATABASE.md` rewritten to describe the as-built schema (migration
  order, integrity rules, seeding, and modeling decisions made where the
  spec was ambiguous).
- `docs/AUTHENTICATION.md` rewritten for the as-built auth flow;
  `docs/API.md` updated with implemented auth, catalog, question-bank, and
  test-builder endpoint shapes; `docs/SECURITY.md`'s Auditability section
  updated to reflect the now-implemented (and intentionally scoped) audit
  logging; `docs/EXAM_ENGINE.md`'s Question Selection Strategies section
  updated to distinguish the now-implemented admin-side setup from the
  still-planned attempt-time selection logic.
