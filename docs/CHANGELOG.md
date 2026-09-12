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

- No migrations yet — infrastructure only (Sequelize config wired, no tables
  created). Full schema to be implemented in Phase 2.

### Documentation

- Created `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`,
  `docs/DATABASE.md`, `docs/API.md`, `docs/FRONTEND.md`,
  `docs/EXAM_ENGINE.md`, `docs/AUTHENTICATION.md`,
  `docs/COMMERCE_AND_PAYMENTS.md`, `docs/AI.md`, `docs/SECURITY.md`,
  `docs/DEPLOYMENT.md`, `docs/TESTING.md`, `docs/DECISIONS.md`
  (ADR-001 through ADR-016), `docs/KNOWN_ISSUES.md`,
  `docs/DEVELOPMENT_STATUS.md`, and root `CLAUDE.md`.
