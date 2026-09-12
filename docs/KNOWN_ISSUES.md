# Known Issues

## High

(none)

## Medium

(none)

## Low

(none)

## Technical Debt

- **No automated test covers the database schema itself.** Phase 2's
  migrations/constraints (the partial unique index on `attempts`, the
  `product_items` CHECK constraint, full migrate-undo/reapply) were verified
  manually against a real PostgreSQL database during that session, not via
  an automated test that runs in CI. Add an integration test that runs
  migrations against a scratch test database and asserts these constraints
  actually reject bad data, so a future schema change can't silently break
  them.
- **`requirePermission` middleware is untested.** It was implemented in
  Phase 3 (`src/middleware/auth.ts`) but no route uses it yet, so it has no
  integration-test coverage — only type-checking. Write its first
  integration test against Phase 4's first permission-gated admin route,
  don't just assume it works because it compiles.
- **Session duration is a hardcoded constant**, not configurable via
  environment variable (`SESSION_DURATION_MS = 30 days` in
  `src/services/authService.ts`). Fine for now; revisit if a product
  requirement needs a different or per-role session length.
