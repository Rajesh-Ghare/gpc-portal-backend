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

### Changed

- Split the project into two separate git repositories, `gpc-portal-backend`
  (this repo — now also owns the full `docs/`/`CLAUDE.md`) and
  `gpc-portal-frontend`, rather than one monorepo (ADR-016). `docs/`,
  `CLAUDE.md`, and the root `README.md` moved from the shared parent folder
  into this repo; `gpc-portal-frontend` got its own short README pointing
  back here.

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
  (ADR-001 through ADR-019), `docs/KNOWN_ISSUES.md`,
  `docs/DEVELOPMENT_STATUS.md`, and root `CLAUDE.md`.
- `docs/DATABASE.md` rewritten to describe the as-built schema (migration
  order, integrity rules, seeding, and modeling decisions made where the
  spec was ambiguous).
