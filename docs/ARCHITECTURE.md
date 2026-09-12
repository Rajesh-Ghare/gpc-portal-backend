# Architecture

## Style

**Modular monolith.** One backend deployable, organized into modules by domain
(auth, catalog, questions, tests, attempts, results, commerce, payments, ai,
system). Do NOT introduce microservices, message queues between "services", or
separate deployables for individual modules. See `docs/DECISIONS.md` ADR-001.

## Backend Layering

```
React (frontend)
   ↓ HTTP/JSON
Express /api/v1
   ↓
Middleware (auth, validation, error handling, rate limiting)
   ↓
Controllers        (thin: parse request, call a service, shape response)
   ↓
Services           (business logic / workflows live here)
   ↓
Repositories       (data-access; wrap Sequelize models)
   ↓
Sequelize models
   ↓
PostgreSQL
```

Supporting concerns that cut across layers:

- **Policies** — authorization/domain-permission decisions (e.g. "can this user
  view this attempt?"). Called from services, not scattered as inline role
  checks.
- **Strategies** — interchangeable behavior selected at runtime, e.g. question
  selection (`ManualSelectionStrategy` vs `RuleBasedSelectionStrategy`) or answer
  evaluation per question type.

Rules:

- Controllers must not contain business logic or direct Sequelize calls.
- Large business workflows must not live inside Sequelize model hooks
  (`beforeSave`, etc.) — hooks are for narrow, model-local invariants only, not
  multi-table workflows. Multi-step workflows belong in services and use
  explicit database transactions.
- Cross-module reads should go through the other module's service/repository,
  not by reaching into its Sequelize models directly, to keep module boundaries
  meaningful even inside a single codebase.

## Repository Split

The backend (`gpc-portal-backend`, this repo) and frontend
(`gpc-portal-frontend`) are separate git repositories (ADR-016), each
deployed independently. This repo also holds the full `docs/` folder and
`CLAUDE.md` for the whole platform — see "Where Things Live" in `CLAUDE.md`.

## Backend Directory Structure (this repo)

```
gpc-portal-backend/
├── src/
│   ├── api/v1/routes/    Express routers, mounted under /api/v1
│   ├── controllers/      Thin request handlers
│   ├── services/         Business logic, organized by domain module
│   ├── repositories/     Data-access layer wrapping Sequelize models
│   ├── policies/         Authorization decisions
│   ├── strategies/       Interchangeable behaviors (selection, evaluation, AI, payment)
│   ├── models/           Sequelize models + associations
│   ├── migrations/       Sequelize migrations (source of truth for schema)
│   ├── seeders/          Sequelize seeders (development sample data)
│   ├── middleware/       Auth, validation, error handling, rate limiting
│   ├── config/           Environment/config loading, Sequelize config
│   ├── constants/        Enums, error codes, permission codes
│   ├── errors/           Centralized AppError + error-code catalog
│   ├── types/            Shared TypeScript types/DTOs
│   ├── validations/      Request validation schemas (zod)
│   └── utils/            Small stateless helpers
└── tests/
    ├── unit/
    ├── integration/
    └── security/
```

## Frontend Directory Structure (`gpc-portal-frontend` repo)

```
gpc-portal-frontend/
├── src/
│   ├── app/              Router setup, providers, layout shells
│   ├── components/       Shared/reusable UI components
│   ├── features/         Feature-scoped modules (auth, tests, attempt, admin/*)
│   ├── hooks/            Shared React hooks
│   ├── services/         API client functions (TanStack Query hooks live near features)
│   ├── stores/           Zustand stores (client-only state, used sparingly)
│   ├── questionTypes/    Question renderer registry (see EXAM_ENGINE.md)
│   ├── utils/
│   ├── constants/
│   ├── validations/
│   └── permissions/      Frontend permission-code helpers (never authoritative)
```

## API Versioning

All routes are mounted under `/api/v1`. Breaking API changes get a new version
prefix rather than mutating `/api/v1` incompatibly. See ADR for API versioning in
`docs/DECISIONS.md` once a v2 need actually arises.

## What Must Never Change Casually

- The modular-monolith style (no microservices split without a new ADR).
- The controller/service/repository layering.
- The rule that the frontend is never authoritative for price, payment status,
  entitlement, attempt count, remaining time, question selection, correct
  answers, score, result visibility, or permissions (see `SECURITY.md`).
- The attempt snapshot guarantee (`EXAM_ENGINE.md`).
- The requirement that AI-generated questions require human review before use.
- The requirement that schema changes go through Sequelize migrations, never
  `sync({ alter: true })` / `sync({ force: true })` against a real database.
