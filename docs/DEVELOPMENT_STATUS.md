# Development Status

## Current Phase

Phase 1 - Project Foundation (complete, pending user review before Phase 2)

## Overall Progress

- [x] Project foundation
- [ ] Database foundation
- [ ] Authentication
- [ ] Exam catalog
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

## Current Work

Phase 1 foundation is verified and complete. Awaiting user confirmation before
starting Phase 2 (database schema: Sequelize models + migrations for the full
table set).

## Completed

- Project split into two git repositories (ADR-016): `gpc-portal-backend`
  (this repo — API + full `docs/`/`CLAUDE.md`) and `gpc-portal-frontend`
  (client app). Both initialized locally with `main` as the default branch;
  neither has been pushed to GitHub yet.
- `gpc-portal-frontend` scaffolded via `npm create vite@latest --
  --template react-ts` (Vite 8, React 19, TypeScript 6). Added
  `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`.
  Feature-module directory skeleton created per `docs/ARCHITECTURE.md`
  (`app/ components/ features/ hooks/ services/ stores/ questionTypes/
  utils/ constants/ validations/ permissions/`). Has its own README pointing
  back to this repo for full project context.
- This repo (`gpc-portal-backend`) initialized with TypeScript, Express 5,
  Sequelize 6, pg, dotenv, jsonwebtoken, cors, helmet, morgan, zod, uuid,
  argon2 (runtime); typescript, eslint (flat config) + typescript-eslint +
  prettier, vitest + supertest, tsx, nodemon, sequelize-cli (dev).
  `tsconfig.json` (strict mode, `module`/`moduleResolution: node16`).
- Directory skeleton per `docs/ARCHITECTURE.md`:
  `api/v1/routes controllers services repositories models migrations seeders
  middleware policies strategies utils constants errors types validations`
  under `src/`, plus `tests/{unit,integration,security}`.
- Centralized response envelope (`src/utils/apiResponse.ts`), error-code
  catalog (`src/errors/errorCodes.ts`) matching `docs/API.md`, `AppError`
  class, and Express error-handling middleware
  (`src/middleware/errorHandler.ts`).
- Express app bootstrap (`src/app.ts`) with helmet/cors/morgan, a `/health`
  check, and the `/api/v1` router mount; `src/server.ts` entry point that
  connects Sequelize (logging but not crashing on failure, since no local
  PostgreSQL is required to boot the API in Phase 1) and starts the HTTP
  server.
- Sequelize wiring: `src/config/env.ts` (typed env access for app code),
  `src/config/database.ts` (Sequelize instance, `underscored: true`),
  `src/config/sequelize-cli.js` (plain-JS config consumed directly by
  `sequelize-cli`, per `.sequelizerc`). Verified `sequelize-cli
  db:migrate:status` loads this config correctly.
- `.env.example` in both repos; each repo has its own `.gitignore`.
- Full `docs/` folder in this repo: PROJECT_CONTEXT, ARCHITECTURE, DATABASE,
  API, FRONTEND, EXAM_ENGINE, AUTHENTICATION, COMMERCE_AND_PAYMENTS, AI,
  SECURITY, DEPLOYMENT, TESTING, DECISIONS (ADR-001..ADR-016), KNOWN_ISSUES,
  CHANGELOG, this file. `CLAUDE.md` and `README.md` at this repo's root.
- Language convention decided and recorded: TypeScript for both repos
  (ADR-003), Node.js 20+ required, developed on 24.2.0 (upgraded locally from
  an EOL 18.20.4 by the project owner via nvm).
- Personal SSH identity set up for pushing to the project owner's personal
  GitHub account, isolated from other git identities on the same machine: a
  dedicated key pair (`~/.ssh/id_ed25519_personal`) and an SSH config host
  alias `github-personal` → `github.com`. This is a local machine-config
  detail, not part of either repo.
- **Verified working:**
  - Backend: `npx tsc --noEmit` clean, `npx eslint .` clean, `npx tsc -p
    tsconfig.json` builds to `dist/` cleanly, `npx vitest run` passes (1
    smoke test asserting `/health` returns the standard success envelope).
  - Backend boots via `tsx src/server.ts`, logs a (expected, since no local
    Postgres password is configured) DB connection error without crashing,
    and serves `GET /health` → `200 {"success":true,...}` and
    `GET /api/v1` → `200`.
  - Frontend: `npx tsc -b` clean, `npm run lint` (oxlint) clean, `vite`
    dev server boots and serves `GET /` → `200`.

## In Progress

Nothing — Phase 1 scope is complete. Next actual code work starts in Phase 2.

## Blocked

None. Waiting on the project owner to: (1) add the `github-personal` SSH
public key to their personal GitHub account, and (2) create the
`gpc-portal-backend` / `gpc-portal-frontend` repos there, before the initial
push can happen.

## Known Issues

None. See `docs/KNOWN_ISSUES.md`.

## Next Recommended Task

1. Push both repos to the project owner's personal GitHub account (remotes
   not yet configured — see Handover Notes).
2. Phase 2: Sequelize models + migrations for the full schema, starting with
   the auth tables (`pgcrypto` extension, then `users`, `roles`,
   `permissions`, `user_roles`, `role_permissions`, `otp_requests`,
   `sessions`), in the exact order specified in `docs/DATABASE.md`. Each
   migration should be paired with its Sequelize model and, where the table
   is foundational (roles/permissions), a seeder. Do not proceed to Phase 3
   (authentication logic) until the auth tables + seed data exist and
   migrations run cleanly against a real local PostgreSQL database (not yet
   verified in this session — no PostgreSQL server was available/configured
   in this environment).

## Last Updated

2026-09-13

## Last Development Session

Initial project creation from the master implementation spec (fresh,
pre-existing-empty directory — no prior code to reconcile). Decided with the
project owner: TypeScript for backend + frontend (ADR-003); Node upgraded
locally from 18.20.4 (EOL) to 24.2.0 via nvm. Built and verified the full
Phase 1 foundation. Midway through the session, the project owner requested
two changes: (1) push to their personal GitHub account rather than the
office account active on this machine — resolved via a dedicated SSH key +
host alias (`github-personal`), kept out of both repos; (2) split backend and
frontend into two separate repos rather than one monorepo — resolved via
ADR-016 (this repo now owns `docs/`/`CLAUDE.md` for the whole platform). No
migrations, models, or API routes beyond the health check exist yet — this
session is foundation-only, per the spec's explicit instruction not to
implement major features before the foundation is verified. Neither repo has
been pushed yet; awaiting the user's GitHub username/repo confirmation (see
Handover Notes).

## Important Files Changed

- This repo (`gpc-portal-backend`): `CLAUDE.md`, `README.md`, `.gitignore`
  (created)
- `docs/*.md` — all 16 files (created)
- `package.json`, `tsconfig.json`, `.sequelizerc`, `eslint.config.js`,
  `.prettierrc.json`, `.env.example` (created)
- `src/app.ts`, `src/server.ts` (created)
- `src/config/{env.ts,database.ts,sequelize-cli.js}` (created)
- `src/errors/{AppError.ts,errorCodes.ts}` (created)
- `src/utils/apiResponse.ts` (created)
- `src/middleware/errorHandler.ts` (created)
- `tests/unit/app.test.ts` (created)
- `gpc-portal-frontend` (separate repo): Vite React-TS scaffold + added deps
  + feature-module directory skeleton + own README (created)

## Database Changes

None. No migrations exist yet. `pgcrypto` extension migration is the first
item planned for Phase 2 per `docs/DATABASE.md`'s migration order.

## API Changes

- `GET /health` — plain health check outside `/api/v1`, not part of the
  versioned contract, for infra/uptime checks.
- `GET /api/v1` — placeholder root response confirming the router mount.
  Neither is documented as a "real" endpoint in `docs/API.md`'s endpoint list
  since they're infrastructure, not product API surface.

## Testing Status

One backend smoke test (`tests/unit/app.test.ts`) verifying the response
envelope on `/health`. No feature tests yet — each feature phase adds its own
per `docs/TESTING.md`. No frontend test runner has been chosen yet (not
needed until frontend feature work begins).

## Handover Notes

- This is a brand-new project — there is no prior implementation to
  reconcile.
- **Both git repos are initialized locally (`main` branch) but nothing has
  been committed or pushed yet, and neither has a remote configured.** This
  assistant does not commit or push without being explicitly asked. Once the
  project owner has added the `github-personal` SSH key to their personal
  GitHub account and created the `gpc-portal-backend` /
  `gpc-portal-frontend` repos there, the remaining steps are: `git remote add
  origin git@github-personal:<username>/<repo>.git` in each repo, then commit
  and `git push -u origin main`.
- TypeScript was chosen deliberately over JavaScript at project start (see
  ADR-003); do not introduce `.js`/`.jsx` source files in `src/` in either
  repo (the two `.js` config files here — `eslint.config.js`,
  `src/config/sequelize-cli.js` — are deliberate exceptions because their
  respective tools don't consume TypeScript directly).
- No PostgreSQL server was available in this environment/session — the
  Sequelize/`sequelize-cli` wiring is verified to load configuration
  correctly and fail gracefully, but an actual migration has never been run
  against a real database. Verify `npm run migrate` against a real local
  Postgres instance early in Phase 2.
- Do not run `sequelize.sync()` against a real database at any point — schema
  changes go through migrations only (ADR-002, `docs/DATABASE.md`).
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
