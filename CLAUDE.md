# CLAUDE.md

This file is the primary onboarding document for anyone (human or AI) working
on this repository. **Read this file, then `docs/PROJECT_CONTEXT.md`, then
`docs/DEVELOPMENT_STATUS.md`, then `docs/DECISIONS.md`, before writing any
code.** Do not assume you have access to prior Claude Code conversation
history — the repository must be self-contained. If something important is
only "known" from a past conversation and isn't written down here or in
`docs/`, write it down before relying on it.

## Project Purpose

A generic, configuration-driven competitive-exam practice platform (not
hardcoded to any one exam). Students log in with mobile OTP, purchase access
to a test, take a timed online exam with autosaved answers, and receive a
backend-evaluated result. See `docs/PROJECT_CONTEXT.md` for the full business
context, and `docs/EXAM_ENGINE.md` / `docs/COMMERCE_AND_PAYMENTS.md` for the
mechanics of the two most sensitive workflows.

## Technology Stack

- **Backend**: Node.js (22+ LTS), Express, TypeScript, PostgreSQL, Sequelize
  ORM, REST API under `/api/v1`.
- **Frontend**: React, Vite, TypeScript, React Router, TanStack Query (server
  state), Zustand (client-only state, used sparingly).
- **Architecture**: modular monolith (see ADR-001 in `docs/DECISIONS.md`) — no
  microservices.

TypeScript is the project-wide convention for both backend and frontend
(ADR-003) — do not add `.js`/`.jsx` source files to `backend/src` or
`frontend/src`.

## Repository Structure

The project is split across **two separate git repositories** (ADR-016):

```
gpc-portal-backend/    This repo. Express + TypeScript API, plus the full
                       docs/ folder and this CLAUDE.md — the source of truth
                       for the whole platform, not just backend code.
gpc-portal-frontend/   React + Vite + TypeScript SPA. Has its own short
                       README that links back here for full project context.
```

Within this repo:

```
src/      Express application source (see docs/ARCHITECTURE.md)
docs/     Living documentation — the source of truth for project state
```

Because documentation lives here rather than in a shared parent folder,
**any change to the frontend that affects the API contract, routes, or UX
requirements documented here (`docs/API.md`, `docs/FRONTEND.md`,
`docs/EXAM_ENGINE.md`) must be reflected in this repo's docs even if the code
change happened in `gpc-portal-frontend`.**

## Important Architectural Rules

- Layering is controller → service → repository → Sequelize → PostgreSQL.
  Controllers stay thin; business logic lives in services; data access lives
  in repositories. Do not put multi-table business workflows inside Sequelize
  model hooks.
- Authorization is permission-code based (`question.approve`, `test.publish`,
  etc.), never scattered `if (role === 'ADMIN')` checks (ADR-012).
- Interchangeable behavior (question selection, answer evaluation, payment
  provider, AI provider, OTP provider) is implemented via a strategy/interface
  pattern so a concrete implementation can be swapped without touching the
  code that calls it.
- Full details: `docs/ARCHITECTURE.md`.

## Database Conventions

- PostgreSQL + Sequelize migrations only. **Never** run
  `sequelize.sync({ alter: true })` or `sequelize.sync({ force: true })`
  against a real database (ADR-002).
- UUID primary keys via `pgcrypto` (ADR-013). `underscored: true` (camelCase in
  code, snake_case in the DB). `created_at`/`updated_at` on every table;
  `deleted_at` (soft delete) where the spec calls for it.
- Never cascade-delete historical/transactional data (attempts, results,
  orders, payments, entitlements, audit logs).
- Full schema and migration order: `docs/DATABASE.md`.

## API Conventions

- Base path `/api/v1`. Every response uses the standard envelope
  (`{ success, message, data, meta }` or `{ success: false, message,
  errorCode, errors }`) — see `docs/API.md` for the full error-code catalog.
- Request validation happens at the boundary via `zod` schemas; services
  assume already-validated input.

## Authentication Rules

Mobile number + OTP is the primary login path (ADR-005). Raw OTPs and raw
session tokens are never persisted — only their hashes. See
`docs/AUTHENTICATION.md`.

## Exam-Engine Rules

- Attempt creation validates auth, entitlement, test status/schedule, attempt
  policy, and question availability, then creates the attempt +
  attempt_questions inside one transaction.
- Once created, an attempt's questions/order/marks are **frozen** — later
  question-bank edits must never alter an existing attempt (ADR-008).
- The timer is backend-authoritative (`started_at`/`expires_at`); the frontend
  only displays a countdown (ADR-009).
- Submission is transactional and idempotent — resubmitting an already-
  submitted attempt returns the existing result, never a duplicate.
- Full details: `docs/EXAM_ENGINE.md`.

## Payment Rules

- Entitlements are only created after a verified payment-provider webhook
  (signature verified, event-idempotency checked, amount/currency verified) —
  never from a frontend "payment succeeded" signal.
- All provider-specific logic lives behind a `PaymentGateway` interface; a
  mock provider (`PAYMENT_PROVIDER=mock`) exists for local development and
  must exercise the same verification path as a real provider.
- Full details: `docs/COMMERCE_AND_PAYMENTS.md`.

## Frontend Rules

- Server data lives in TanStack Query's cache; Zustand is only for genuinely
  client-only state (e.g. UI toggles, exam-navigation drawer state).
- Question rendering goes through the `questionRendererRegistry`, never
  hardcoded per-type branches spread through components.
- Mobile-first for the student exam UI (360px+); see `docs/FRONTEND.md`.

## Security Rules

The frontend is **never** authoritative for price, payment status,
entitlement, attempt count, remaining time, question selection, correct
answers, score, result visibility, or permissions. During an active attempt,
never expose `is_correct`, `correct_option_id`, solutions, or AI metadata to
the client. Full checklist: `docs/SECURITY.md`.

## Documentation Rules

**Update documentation in the same task as the code change that makes it
stale.** If you add a table → update `docs/DATABASE.md`. If you change an API
→ update `docs/API.md`. If you make an architectural decision → add an ADR to
`docs/DECISIONS.md`. Every meaningful task ends with `docs/DEVELOPMENT_STATUS.md`
and `docs/CHANGELOG.md` updated — see "Development Workflow" below.

## Development Workflow

At the start of every session:

1. Read this file.
2. Read `docs/PROJECT_CONTEXT.md`.
3. Read `docs/DEVELOPMENT_STATUS.md`.
4. Read `docs/DECISIONS.md`.
5. Read the relevant module doc (`docs/DATABASE.md`, `docs/EXAM_ENGINE.md`,
   etc.) before modifying that module.
6. Run `git status` and check recent `git log` when needed.

At the end of every meaningful task:

1. Update `docs/DEVELOPMENT_STATUS.md` (current phase, what changed, what's
   next, blockers, known issues).
2. Update `docs/CHANGELOG.md`.
3. Update any technical doc the change affected.
4. Update `docs/KNOWN_ISSUES.md` if applicable (add new issues, remove fixed
   ones — never leave a resolved issue marked active).
5. Add an ADR to `docs/DECISIONS.md` if an architectural decision was made or
   changed (never silently reverse a prior accepted ADR — record a new one
   explaining why).
6. Run tests, lint, and build for anything touched; do not mark work complete
   because "it compiles."

Work in small, logical commits (see `docs/DEVELOPMENT_STATUS.md`'s "Important
Files Changed" section as a model for what each commit should be describable
as). Do not bundle unrelated changes into one commit.

## What Must NEVER Be Changed Casually

- The modular-monolith architecture (no microservices without a new ADR).
- The controller/service/repository layering.
- `sequelize.sync({ alter/force: true })` against real data — forbidden.
- The attempt-snapshot guarantee.
- The rule that AI-generated questions require human approval before use.
- The frontend-never-authoritative security rules above.
- Any accepted ADR in `docs/DECISIONS.md` — propose a new ADR instead of
  silently reversing one.

## Where Things Live

| Question | Where |
|---|---|
| What's the current project status? | `docs/DEVELOPMENT_STATUS.md` |
| What decisions have been made and why? | `docs/DECISIONS.md` |
| What's the DB schema? | `docs/DATABASE.md` |
| What API endpoints exist? | `docs/API.md` |
| What's broken / outstanding? | `docs/KNOWN_ISSUES.md` |
| What changed recently? | `docs/CHANGELOG.md` |
| How do I run this locally? | `docs/DEPLOYMENT.md` |
| How do I test this? | `docs/TESTING.md` |

## Running the Project

See `docs/DEPLOYMENT.md` for full local setup. Quick reference (assumes
`gpc-portal-backend` and `gpc-portal-frontend` are cloned as sibling
directories):

```bash
# This repo (backend)
npm install && npm run dev

# ../gpc-portal-frontend
npm install && npm run dev
```

Migrations/seeders (once they exist beyond Phase 1 infrastructure):

```bash
npm run migrate
npm run seed
```
