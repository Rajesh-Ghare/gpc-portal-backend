# Development Status

## Current Phase

Phase 14 - Testing (complete)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [x] Question bank
- [x] Test builder
- [x] Exam engine
- [x] Results
- [x] Commerce
- [x] Payments
- [x] AI
- [x] Student frontend
- [x] Admin frontend
- [x] Testing
- [ ] Deployment

## Current Work

Phase 14 is complete. Awaiting user confirmation before starting Phase 15
(Deployment) — the final phase per the spec's own order: containerizing
both repos, environment/secrets configuration for a real deployment
target, and a production readiness pass (the kind of thing
`docs/DEPLOYMENT.md`, still Phase-1-era placeholder content, needs to
become concrete).

## Completed (Phase 14, this session)

### Backend (`gpc-portal-backend`)

Closed every remaining item this project had left open across
`docs/SECURITY.md` and `docs/KNOWN_ISSUES.md`:

- **A student cannot view another student's result** — new assertion in
  `tests/integration/results.test.ts` (`getResult`'s ownership check,
  `errorCode FORBIDDEN`), previously only implied by the already-tested
  attempt-ownership case.
- **A client-forged `attemptLimit` in the attempt-creation request body has
  no effect** — new assertion in `tests/integration/attempt.test.ts`:
  grants an entitlement with `attemptLimit: 1`, sends `{ attemptLimit: 999
  }` on both attempt-creation calls, the second is still rejected
  `ATTEMPT_LIMIT_EXCEEDED`. (`createAttempt()`'s controller never reads
  `req.body` at all — the test now proves that rather than just asserting
  it from reading the code.)
- **The `product_items_target_matches_access_type` CHECK constraint
  (ADR-018) is verified at the database level**, not just via the
  app-layer Zod schema in front of it — new assertion in
  `tests/integration/commerce.test.ts` creates a `ProductItem` directly
  (bypassing `createProductItemSchema` entirely) with a mismatched target
  and asserts Postgres itself rejects it (`SequelizeDatabaseError`,
  `parent.code === '23514'`, the real check_violation SQLSTATE).
- `docs/SECURITY.md`'s Required Security Test Coverage checklist: every
  item is now checked, each with its own dedicated test — none left as
  "implied by a related one."
- `docs/TESTING.md`: rewritten to document actual coverage per spec
  section 47's categories, and to explicitly record *why* scoring/
  selection/evaluation logic is tested via integration tests against a
  real database rather than isolated unit tests with mocked Sequelize
  models — consistent with this project's established preference (real
  I/O over fakes, except for genuinely external providers like
  OTP/payment/AI).
- **77 backend tests total** (74 → 77; three new assertions, no new test
  files), all passing.

### Frontend (`gpc-portal-frontend`)

A real test runner, added for the first time this phase (per the user's
explicit choice — see Decisions below):

- **Vitest + React Testing Library + `@testing-library/jest-dom`** (+
  `@testing-library/user-event` for interaction tests), `jsdom`
  environment, configured directly in `vite.config.ts` (imports
  `defineConfig` from `vitest/config` rather than `vite`, so one config
  file serves both the dev/build and the test runner — no separate
  `vitest.config.ts` needed). `src/setupTests.ts` registers jest-dom's
  matchers and RTL's `cleanup()` after every test (without this, DOM from
  one test leaks into the next within the same file — found immediately
  when the `QuestionNavigator` tests failed with "multiple elements
  found" until this was added).
- **41 tests across 8 files**, all passing:
  - `src/utils/format.test.ts`, `src/utils/errorMessage.test.ts` — pure
    unit tests for formatting/error-mapping logic.
  - `src/features/attempt/utils.test.ts` — a **regression test locking in
    the Phase 12 bug fix**: `isQuestionAnswered()` must return `false` for
    a never-touched question (`answer: null`), the exact case the original
    unguarded optional-chain comparison got wrong.
  - `src/permissions/index.test.ts` — `hasPermission`/`usePermission`/
    `useIsAdmin` against a real `authStore` (via `renderHook`), covering
    both "has the permission" and "no current user at all."
  - `src/questionTypes/index.test.tsx` — the renderer registry resolves
    each of the six documented types to the right component and falls
    back to `MCQSingle` for an unrecognized type.
  - `src/questionTypes/MCQSingle.test.tsx`,
    `src/features/attempt/components/QuestionNavigator.test.tsx`,
    `src/features/auth/LoginPage.test.tsx` — component tests exercising
    real rendering + `userEvent` interaction (click an option, click a
    navigator cell, submit an invalid mobile number) rather than just
    calling functions directly.
- `package.json` gained a `test` script (`vitest run`).

### Decisions made this phase

- **User explicitly chose unit/component tests only, no committed
  end-to-end/browser suite** (asked directly, since installing Playwright
  is a real dependency/tooling decision with tradeoffs — browser binary
  downloads, slower installs — that `docs/DEVELOPMENT_STATUS.md` had
  flagged after Phase 13 as needing a deliberate choice rather than being
  half-adopted). The ad hoc Chrome DevTools Protocol scripts used for
  manual verification in Phases 12–13 remain exactly that: a documented,
  repeatable-by-hand fallback method (`docs/FRONTEND.md`), not committed
  anywhere. Revisit if/when this project actually needs CI-enforced
  end-to-end coverage.

## In Progress

Nothing — Phase 14 scope is complete.

## Blocked

None.

## Known Issues

Two Technical Debt items closed this phase (the CHECK-constraint test gap
and the security-test-coverage gap) — see `docs/KNOWN_ISSUES.md`, both
entries removed rather than left stale. No new known issues from this
phase.

## Next Recommended Task

Phase 15: Deployment. Per the spec's own phase order, the final phase:
containerizing both repos (a `Dockerfile` per repo, likely a
`docker-compose.yml` at the top level for local multi-service orchestration
including PostgreSQL), environment/secrets configuration for whatever
target is chosen, and turning `docs/DEPLOYMENT.md` (still Phase-1-era
placeholder content) into an accurate as-built deployment guide. This is
also a natural point to revisit `docs/KNOWN_ISSUES.md`'s remaining
lower-priority items (pagination, a real non-mock `PaymentGateway`, order
cancellation) and decide which, if any, are worth addressing before a real
deployment rather than after.

## Last Updated

2026-09-14

## Last Development Session

Implemented and verified Phase 14 (Testing) across both repos. Backend:
closed the last two `docs/SECURITY.md` checklist items and the
`product_items` CHECK-constraint technical-debt item with three new
integration-test assertions (77 tests total, all passing) — no new gaps
found, this was purely closing out already-known, already-documented
items. Frontend: added a real test runner for the first time (Vitest +
React Testing Library, per the user's explicit choice not to add a
committed end-to-end suite this phase), with 41 tests covering utils, the
permissions helpers, the question-renderer registry, and three components
— including a regression test that locks in the "answered" counter bug
Phase 12's browser testing found and fixed, so it can't silently
regress. `docs/TESTING.md` was rewritten to give an honest, complete
account of both repos' testing status and the reasoning behind this
project's testing choices (integration-over-mocked-unit for DB-coupled
logic; unit/component-over-E2E for the frontend, for now).

## Important Files Changed

**`gpc-portal-backend`** (this repo):
- `tests/integration/{attempt.test.ts,results.test.ts,commerce.test.ts}`
  (three new assertions)
- `docs/SECURITY.md` (checklist fully checked), `docs/KNOWN_ISSUES.md`
  (two items closed), `docs/TESTING.md` (rewritten), `docs/CHANGELOG.md`,
  `docs/DEVELOPMENT_STATUS.md` (this file)

**`gpc-portal-frontend`** (companion repo):
- `vite.config.ts` (test config added), `src/setupTests.ts` (created),
  `package.json` (`test` script + new devDependencies)
- `src/utils/{format.test.ts,errorMessage.test.ts}`,
  `src/features/attempt/utils.test.ts`, `src/permissions/index.test.ts`,
  `src/questionTypes/index.test.tsx`,
  `src/questionTypes/MCQSingle.test.tsx`,
  `src/features/attempt/components/QuestionNavigator.test.tsx`,
  `src/features/auth/LoginPage.test.tsx` (all created)
- `README.md` (test script documented, status updated)

## Database Changes

None.

## API Changes

None — this phase added test coverage for existing behavior only.

## Testing Status

- Backend: 77 tests across 12 files (2 unit, 10 integration), all passing
  against a real PostgreSQL database.
- Frontend: 41 tests across 8 files, all passing (Vitest + jsdom + React
  Testing Library). No end-to-end suite (deliberate — see Decisions above).

## Handover Notes

- **`src/setupTests.ts`'s `afterEach(cleanup)` is load-bearing** — remove
  it and component tests within the same file will see leftover DOM from
  previous tests (this happened immediately when writing
  `QuestionNavigator.test.tsx`, surfacing as spurious "multiple elements
  found" errors that had nothing to do with the component itself).
- **`vite.config.ts` imports `defineConfig` from `'vitest/config'`, not
  `'vite'`** — this is what makes the `test` field type-check; changing
  the import back to `'vite'` would silently lose type-checking on the
  test config (it would likely still work at runtime, but should not be
  "fixed" without understanding why it's this way).
- **The end-to-end/Playwright decision was deliberately deferred, not
  forgotten.** If a future phase decides to add it, `docs/TESTING.md` and
  this file both explain the reasoning that led to deferring it here —
  read that before silently introducing a new E2E tool.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
