# Development Status

## Current Phase

Phase 2 - Database Foundation (complete, verified against real PostgreSQL)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
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

(Catalog/question bank/test builder/exam engine/results/commerce/payments/AI
checkboxes above track the *business-logic* phases — services, controllers,
routes. Their **schema** already exists as of Phase 2; see `docs/DATABASE.md`.)

## Current Work

Phase 2 is complete and verified end-to-end against a real local PostgreSQL
17 database. Awaiting user confirmation before starting Phase 3
(Authentication: OTP request/verify, sessions, protected routes).

## Completed (Phase 2, this session)

- **All 43 migrations** written and applied (`src/migrations/`,
  `20260913000001`–`20260913000043`): `pgcrypto` extension, all 41 tables
  from the spec across auth, exam catalog, question bank, test assembly,
  attempt engine, results, commerce, AI, and system domains, plus one
  necessary addition — a deferred FK migration linking
  `questions.generation_job_id` to `ai_generation_jobs.id` (that table
  doesn't exist yet when `questions` is created, per the spec's own migration
  order; see ADR-019).
- **Full rollback/reapply verified**: `db:migrate:undo:all` then `db:migrate`
  run against a real database with zero errors — every migration's `down()`
  actually works, not just `up()`.
- **All 41 corresponding Sequelize models** written in TypeScript
  (`src/models/`, one file per table) using `Model<InferAttributes<...>,
  InferCreationAttributes<...>>` — no `sequelize-typescript` decorator
  dependency added (kept minimal per the "don't over-engineer TypeScript"
  guidance). `src/models/index.ts` wires every model's `init()` and
  `associate()` call.
- **Explicit models for join tables with extra/asymmetric timestamp columns**
  (`UserRole`, `RolePermission`, `QuestionTag`, `TestRuleTag`) rather than
  Sequelize's implicit string-based `through:` tables — needed because an
  implicit join model inherits the global `timestamps: true` default and
  would incorrectly try to write a nonexistent `updated_at` column on tables
  the spec defines with `created_at` only. Caught by an actual failing query
  against the real database, not just by inspection.
- **A database-level `CHECK` constraint** on `product_items`
  (`product_items_target_matches_access_type`) enforcing the spec's "exactly
  the right target column for the access_type" rule at the DB layer, not only
  in future service code. Verified: a deliberately mismatched insert is
  rejected by Postgres. See ADR-018.
- **Partial unique index** on `attempts` — at most one `IN_PROGRESS` attempt
  per `(user_id, test_id)` — confirmed present in the real schema via `\d
  attempts`, per spec section 15.
- **6 seeders** (`src/seeders/`, run via `npm run seed`), each with a working
  `down()`, verified round-trip (`seed:all` → `seed:undo:all` → `seed:all`):
  roles/permissions (SUPER_ADMIN/ADMIN/STUDENT + 20 permission codes),
  3 users (one per role), SSC/SSC CGL catalog, Quantitative Aptitude
  subject with Percentage/Profit & Loss topics, 4 sample MCQ_SINGLE questions
  (with versions/translations/options), 1 published sample test, 1 sample
  product with pricing and a `product_item` — see `docs/DATABASE.md` for
  detail.
- **A comprehensive cross-domain smoke test** (written, run, and discarded —
  not committed, since it duplicated what the seeders now cover) created and
  read back a full object graph spanning every domain — category → exam →
  series → test → section → subject → topic → question → version →
  translation → option → tag → test_question → attempt → attempt_question →
  attempt_answer → result → result_detail → product → price → item → order →
  order_item → payment → entitlement → ai_generation_job → item → audit_log →
  system_setting — through the Sequelize model layer (not raw SQL), including
  a deep multi-association `include` read back out. This is the strongest
  signal that the schema and models are internally consistent.
- **Fixed a latent Phase 1 tsconfig bug**: `rootDir: "src"` conflicted with
  `tests/**/*.ts` also being included, which `tsc --noEmit`/`tsc -p
  tsconfig.json` would have failed on (this had gone unnoticed because the
  Phase 1 build was run once, before the test file existed). Split into
  `tsconfig.json` (type-checking, includes `src` + `tests`) and
  `tsconfig.build.json` (production build, `src` only, `rootDir: "src"`).
  `package.json`'s `build` script now points at `tsconfig.build.json`.
- **New PostgreSQL setup discovered and used**: this machine has PostgreSQL
  15/16/17 installed as three separate Windows services (ports 5432/5433/5434
  respectively — note the port numbers do **not** match the version numbers
  in the obvious way; verified each by connecting and checking `version()`).
  Development against PostgreSQL 17 on port 5433, database `competitive_exam`
  (+ `competitive_exam_test`), user `postgres`. This is captured in the local
  `.env` (gitignored) — `.env.example` still documents the conventional 5432
  default for other environments.

## In Progress

Nothing — Phase 2 scope is complete.

## Blocked

None.

## Known Issues

None. See `docs/KNOWN_ISSUES.md`.

## Next Recommended Task

Phase 3: Authentication.
- `OtpProvider` interface + `MockOtpProvider` (ADR-006).
- `POST /auth/request-otp`, `POST /auth/verify-otp`, `GET /auth/me`,
  `POST /auth/logout` (per `docs/API.md`).
- Session creation/revocation against the `sessions` table (already
  migrated).
- Auth middleware (JWT or session-token verification — confirm approach
  against ADR-005/`docs/AUTHENTICATION.md` before implementing; no auth
  middleware exists yet).
- Permission-checking middleware (`requirePermission(code)`) against the
  seeded `roles`/`permissions`/`role_permissions` data.
- Integration tests: OTP request/verify, session issuance/revocation,
  protected-route rejection for unauthenticated/wrong-permission requests
  (per `docs/TESTING.md`).

## Last Updated

2026-09-13

## Last Development Session

Implemented and fully verified Phase 2 (database foundation) against a real
local PostgreSQL 17 database discovered on this machine (see Completed
above for the port/version mismatch caught along the way). All 43 migrations
and 41 models exist, round-trip cleanly (up/down, and seed/unseed), and were
proven consistent via a full cross-domain smoke test through the model layer.
Fixed a latent tsconfig bug from Phase 1. No business-logic services,
controllers, or API routes exist yet beyond the Phase 1 health check — this
session was schema-and-models only, per the standing instruction to
implement phases sequentially and verify each before moving on.

## Important Files Changed

- `src/migrations/20260913000001-*.js` through `...000043-*.js` (created —
  43 files)
- `src/utils/migrationHelpers.js` (created)
- `src/models/*.ts` (created — 41 model files) and `src/models/index.ts`
  (created)
- `src/seeders/20260913100001-*.js` through `...100006-*.js` (created —
  6 files)
- `tsconfig.json` (modified — removed `rootDir`), `tsconfig.build.json`
  (created), `package.json` (modified — `build` script now uses
  `tsconfig.build.json`)
- `.env` (modified locally — real DB port/password; gitignored, not
  committed)
- `docs/DATABASE.md` (rewritten for the as-built schema), `docs/DECISIONS.md`
  (ADR-017, ADR-018, ADR-019 added)

## Database Changes

Full schema created — see `docs/DATABASE.md` for the complete migration list,
integrity-rule summary, and seeding detail. Summary: 41 tables + `pgcrypto`
extension across auth, exam catalog, question bank, test assembly, attempt
engine, results, commerce, AI, and system domains.

## API Changes

None this session (still just `GET /health` and `GET /api/v1` from Phase 1).

## Testing Status

Still one backend smoke test (`tests/unit/app.test.ts`, unchanged). The
Phase-2 verification (migrations, seeders, cross-domain model smoke test) was
done manually via `tsx`/`psql`/`sequelize-cli` during this session and is
**not** captured as an automated test — that's a gap to close in Phase 3+:
consider adding an integration test that runs migrations against a scratch
test database and asserts key constraints (the partial unique index, the
`product_items` CHECK constraint) actually reject bad data, so this doesn't
regress silently.

## Handover Notes

- Both git repos (`gpc-portal-backend`, `gpc-portal-frontend`) are pushed to
  the project owner's personal GitHub (`Rajesh-Ghare`) via a dedicated SSH
  identity (`github-personal` host alias) — see git history for detail; not
  re-documented here since it's a one-time setup, not an ongoing rule.
- **This dev machine has 3 PostgreSQL versions installed as separate
  services on non-obvious ports** (15→5432, 17→5433, 16→5434 — verified by
  connecting and checking `SELECT version()`, don't assume port numbers
  match version numbers on a fresh clone/machine). A new developer on a
  different machine should just use whatever single PostgreSQL install they
  have, on its default port, and update their own local `.env` accordingly —
  `.env.example` reflects the conventional default (5432), not this
  machine's specific quirk.
- To reproduce this session's verification: `npm run migrate`, then `npm run
  seed`, then check `SELECT count(*) FROM users` etc. — see
  `docs/DATABASE.md`'s Seeding section for expected row counts (3 users,
  4 questions, 1 test, 1 product).
- TypeScript remains the convention for **application** code (models,
  services, etc. — ADR-003). Migrations and seeders are a deliberate
  exception, written in plain CommonJS `.js` because `sequelize-cli` loads
  them directly without our TS build step (ADR-017) — don't "fix" this by
  converting them to `.ts`, and don't add new `.ts` migrations expecting them
  to run without additional tooling work.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
