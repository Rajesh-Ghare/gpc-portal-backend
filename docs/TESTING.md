# Testing

## Backend Test Runner

Vitest (+ Supertest for HTTP integration tests). Tests live in
`backend/tests/{unit,integration}/` (no separate `security/` directory —
security-relevant assertions live inline in the integration test that
already exercises that flow, e.g. an ownership check next to the endpoint
it guards, rather than duplicated in a parallel suite).

## Required Coverage (per spec section 47) — Status

### Unit

- Scoring, negative marking, question selection (manual + rule-based),
  attempt limits, entitlement checks, result calculation: **covered via
  integration tests against a real database, not isolated unit tests.**
  `McqSingleEvaluator`, `ManualSelectionStrategy`, and
  `RuleBasedSelectionStrategy` (`src/strategies/`) each query Sequelize
  models directly rather than taking plain data — mocking that out for a
  "pure" unit test would mean asserting against a fake model layer
  instead of the real one, which is exactly the kind of test this project
  has deliberately avoided (see the OtpProvider/PaymentGateway/AIService
  interface pattern: fakes exist for *external* providers, never for the
  database). `tests/integration/attempt.test.ts` exercises scoring,
  negative marking, and attempt limits end-to-end against a real database
  and real HTTP layer; `tests/integration/testBuilder.test.ts` exercises
  both selection modes; `tests/unit/rankings.test.ts` is the one place a
  true isolated unit test made sense, because `computeRankings()`
  (`src/utils/rankings.ts`) is a pure function with no I/O at all.
- Test validation (publish blocked on invalid config): covered,
  `tests/integration/testBuilder.test.ts`.

### Integration

All implemented and covered: OTP request/verify, session issuance/
revocation (`auth.test.ts`), attempt creation with all its validations,
answer autosave, submission (incl. idempotent re-submit), result
retrieval (`attempt.test.ts`, `results.test.ts`), order creation
(`commerce.test.ts`), payment webhook signature/idempotency/amount
verification (`payment.test.ts`), entitlement creation both via admin
grant and via a paid order (`commerce.test.ts`, `payment.test.ts`).

### Security

All items in `docs/SECURITY.md`'s Required Security Test Coverage
checklist are verified — see that file for the current list and which
test file covers each one. As of Phase 14, every item there has its own
explicit assertion (none are "implied by a related test" anymore).

## Status

77 backend tests across 12 files (2 unit, 10 integration), all passing
against a real PostgreSQL database — see `docs/DEVELOPMENT_STATUS.md`'s
per-phase Testing Status sections for how this grew. The full database
schema (Phase 2) was verified manually against a real PostgreSQL database
rather than via an automated test — see `docs/KNOWN_ISSUES.md` Technical
Debt for what manual-only verification remains (mostly config-shape edge
cases, not core correctness). A `test` Sequelize environment/database
(`<DB_NAME>_test`, `sequelize-cli.js` appends `_test` automatically) holds
the full schema and is what every integration test runs against.
`fileParallelism: false` (`vitest.config.mts`) is required — integration
tests share this one real database and a set of seeded users, and running
test files in parallel raced each other's OTP lookups (see
`docs/DECISIONS.md`/session history for the incident this fixed).

## Running Backend Tests

```bash
cd backend
npm test
```

## Frontend Test Runner — Implemented (Phase 14)

Vitest + React Testing Library + `@testing-library/jest-dom`, run in a
`jsdom` environment (`gpc-portal-frontend/vitest.config.ts`) — chosen over
introducing a second test runner since the backend already uses Vitest;
no reason for the frontend to differ. Tests live next to the file they
cover (`Thing.test.ts`/`Thing.test.tsx`), not in a parallel directory tree.

**Scope, deliberately**: unit tests for pure logic (`src/utils/format.ts`,
`src/utils/errorMessage.ts`, `src/features/attempt/utils.ts`,
`src/permissions/index.ts`) and a handful of component tests for
genuinely tricky rendering/interaction logic (`QuestionNavigator`'s status
classes, `LoginPage`'s client-side validation gating the API call,
`MCQSingle`'s selection state). **No committed end-to-end/browser suite**
— that was an explicit decision (see `docs/DEVELOPMENT_STATUS.md`'s Phase
14 notes): installing Playwright would add a real dependency (browser
binary downloads, slower installs) for a project that already found real
bugs across Phases 12–13 using an uncommitted, ad hoc Chrome DevTools
Protocol script against a live dev server. That ad hoc method remains the
documented fallback for whole-flow verification (`docs/FRONTEND.md`); a
committed E2E suite is a deliberate future decision, not a gap to feel bad
about.

### Running Frontend Tests

```bash
cd frontend
npm test
```
