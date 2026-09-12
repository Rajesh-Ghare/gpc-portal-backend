# Development Status

## Current Phase

Phase 3 - Authentication (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
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
checkboxes track *business-logic* phases — services, controllers, routes.
Their **schema** already exists as of Phase 2; see `docs/DATABASE.md`.)

## Current Work

Phase 3 is complete and verified: manual end-to-end testing against a real
running server + PostgreSQL database, plus an automated integration test
suite. Awaiting user confirmation before starting Phase 4 (Exam Catalog:
admin CRUD for categories/exams/series, permission-gated).

## Completed (Phase 3, this session)

- **`OtpProvider` interface + `MockOtpProvider`** (`src/strategies/otp/`) —
  logs the OTP to the console and keeps the last-sent OTP per mobile number
  in memory for test/dev introspection (`getLastSentOtp`), per ADR-006. A
  provider-selection factory (`getOtpProvider()`) is the only place that
  knows the string `'mock'`.
- **Two deliberately different hashing strategies**, documented in
  `src/utils/authTokens.ts` and ADR-020: `argon2` (slow, salted) for OTPs —
  appropriate for a 6-digit keyspace checked rarely; unsalted `SHA-256`
  (fast) for session tokens — appropriate for a 256-bit random value checked
  on every request.
- **`authService`** (`src/services/authService.ts`): `requestOtp`,
  `verifyOtpAndCreateSession` (find-or-create user + auto-assign STUDENT
  role + create session), `authenticateByToken`, `logout`.
- **Repositories** (`src/repositories/`): `userRepository`,
  `otpRequestRepository`, `sessionRepository` — thin Sequelize wrappers per
  the controller→service→repository layering.
- **Middleware**: `authenticate` (Bearer token → `req.currentUser` /
  `req.currentSession`, `AUTH_UNAUTHORIZED` on failure) and
  `requirePermission(code)` (permission-code check via
  `user.getRoles({ include: 'permissions' })`, `FORBIDDEN` on failure) in
  `src/middleware/auth.ts`; a generic `validateBody(zodSchema)` in
  `src/middleware/validate.ts`.
- **Routes**: `POST /auth/request-otp`, `POST /auth/verify-otp`,
  `GET /auth/me`, `POST /auth/logout` (`src/api/v1/routes/auth.routes.ts`,
  mounted in `src/app.ts`). See `docs/API.md` for request/response shapes.
- **Express type augmentation** (`src/types/express.d.ts`) adding
  `req.currentUser` / `req.currentSession`.
- **Sequelize association mixins added** to `User` (`getRoles`, `addRole`)
  and `Role` (`getPermissions`) — needed for TypeScript to recognize
  Sequelize's dynamically-generated association methods; these weren't
  needed until this phase actually used the associations programmatically.
- **`.env`-driven test database now actually used by the app**: fixed
  `src/config/env.ts` to append `_test` to `DB_NAME` when
  `NODE_ENV=test`, mirroring `sequelize-cli.js`'s existing behavior (until
  now nothing had exercised this path). Added `vitest.config.mts` to set
  `NODE_ENV=test` explicitly for the test run rather than relying on
  defaults.
- **Verified manually against a real running server + PostgreSQL 17**: full
  request-otp → verify-otp → `GET /auth/me` → logout → rejected-after-logout
  flow; unauthenticated-request rejection; malformed-mobile-number
  validation rejection; wrong-OTP rejection with successful retry; OTP
  lockout after `OTP_MAX_ATTEMPTS` (5) wrong attempts, confirmed the
  *correct* OTP is then also rejected.
- **Automated integration tests** (`tests/integration/auth.test.ts`, 5
  tests, run against the real `competitive_exam_test` database): the same
  scenarios above, via Supertest against `createApp()`. Test/seed data uses
  a reserved mobile-number range (`9700000...`) never touched by seeders.
- **Seeded the test database** (`NODE_ENV=test npm run seed`) so
  roles/permissions (needed for STUDENT auto-assignment) exist there too.
- **Fixed a latent Vite/Vitest config warning**: renamed `vitest.config.ts`
  → `vitest.config.mts` (this package.json is CommonJS; Vitest's config
  loader warned about ESM syntax in a `.ts` file under a CJS package).

## In Progress

Nothing — Phase 3 scope is complete.

## Blocked

None.

## Known Issues

None new. See `docs/KNOWN_ISSUES.md` (the Phase 2 DB-constraint testing gap
is still open; `requirePermission` is implemented but has no integration
test yet since no protected route exists to exercise it against — noted
there too).

## Next Recommended Task

Phase 4: Exam Catalog (admin CRUD). Per `docs/API.md`/spec section 24:
categories, competitive exams, test series — permission-gated
(`category`-equivalent permissions don't exist yet in the seeded set; only
the spec's example codes are seeded — decide whether to add
`category.*`/`exam.*`/`series.*` permission codes now or reuse
`test.*`-family codes loosely until the test-builder phase, and record
whichever is chosen as an ADR if it's not obvious). This phase is also the
first real caller of `requirePermission` — write its integration test then,
closing that Known Issues gap.

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 3 (Authentication) end to end: OTP request/
verify with argon2-hashed OTPs, find-or-create user with default STUDENT
role, opaque SHA-256-hashed session tokens (ADR-020 — chosen over JWT since
revocation requires a DB hit either way), `authenticate`/`requirePermission`
middleware, and the four spec'd auth routes. Verified twice — manually
against a live server/database (including deliberately exhausting the OTP
attempt limit) and via 5 new automated integration tests against the real
test database. Also fixed two latent Phase-1/2 issues noticed along the way:
the app's `DB_NAME` didn't actually get the `_test` suffix under
`NODE_ENV=test` (only `sequelize-cli` did), and a Vitest config warning.

## Important Files Changed

- `src/strategies/otp/{OtpProvider.ts,MockOtpProvider.ts,index.ts}` (created)
- `src/utils/authTokens.ts` (created)
- `src/repositories/{userRepository.ts,otpRequestRepository.ts,sessionRepository.ts}` (created)
- `src/services/authService.ts` (created)
- `src/middleware/{auth.ts,validate.ts}` (created)
- `src/validations/auth.validation.ts` (created)
- `src/controllers/authController.ts` (created)
- `src/api/v1/routes/auth.routes.ts` (created)
- `src/app.ts` (modified — mounts `authRouter`)
- `src/types/express.d.ts` (created)
- `src/models/User.ts`, `src/models/Role.ts` (modified — added association mixins)
- `src/config/env.ts` (modified — test DB name suffixing)
- `vitest.config.mts` (created, replacing an earlier `.ts` attempt this same session)
- `tests/integration/auth.test.ts` (created)
- `docs/AUTHENTICATION.md` (rewritten for the as-built flow), `docs/API.md`
  (auth endpoints marked implemented with shapes), `docs/DECISIONS.md`
  (ADR-020)

## Database Changes

None — Phase 3 used the existing `users`, `otp_requests`, `sessions`,
`roles`, `user_roles`, `role_permissions` tables from Phase 2 as-is. The
test database (`competitive_exam_test`) was seeded for the first time this
session.

## API Changes

Added (see `docs/API.md` for full request/response shapes):
- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `GET /auth/me`
- `POST /auth/logout`

## Testing Status

- `tests/unit/app.test.ts` — 1 test (unchanged, `/health`).
- `tests/integration/auth.test.ts` — 5 tests, all passing against the real
  test database: full login/logout round trip, unauthenticated rejection,
  input validation rejection, wrong-OTP-then-correct-OTP, and OTP lockout
  after max attempts.
- Still open (see `docs/KNOWN_ISSUES.md`): no automated test for the Phase 2
  DB constraints themselves; `requirePermission` has no integration test yet
  (nothing to protect with it until Phase 4+).

## Handover Notes

- The test database now has seed data in it (from `NODE_ENV=test npm run
  seed`, run this session) — this is expected and fine; the auth test suite
  is written to only touch its own reserved mobile-number range
  (`9700000001`–`9700000003`) and cleans up after itself in `afterAll`.
- `requirePermission` exists and type-checks but has never been exercised by
  a real protected route or a test that hits one — treat it as unverified
  until Phase 4's first admin route uses it.
- Session duration (30 days) is currently a hardcoded constant
  (`SESSION_DURATION_MS` in `src/services/authService.ts`), not an env var —
  fine for now, revisit if a product requirement needs it configurable.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
