# Testing

## Backend Test Runner

Vitest (+ Supertest for HTTP integration tests). Tests live in
`backend/tests/{unit,integration,security}/`.

## Required Coverage (per spec section 47)

### Unit

- Scoring
- Negative marking
- Question selection (manual + rule-based)
- Test validation (publish blocked on invalid config)
- Attempt limits
- Entitlement checks
- Result calculation

### Integration

- OTP request/verify
- Authentication (session issuance/revocation)
- Test start (attempt creation, including all attempt-start validations)
- Answer save (autosave endpoint)
- Submission (including idempotent re-submit)
- Result retrieval
- Order creation
- Payment webhook (signature, idempotency, amount verification)
- Entitlement creation

### Security

- Student cannot access another student's attempt/result.
- Student cannot submit another student's attempt.
- Correct answers never exposed during an active attempt.
- Frontend-supplied price/entitlement/attempt-limit values cannot override
  server-computed values.
- Students cannot call admin-only endpoints.

## Status

One smoke test exists (`tests/unit/app.test.ts`, `/health` envelope). The
full database schema (Phase 2) was verified manually against a real
PostgreSQL database rather than via an automated test — see
`docs/KNOWN_ISSUES.md` Technical Debt for the gap this leaves. A `test`
Sequelize environment/database (`<DB_NAME>_test`, `sequelize-cli.js` appends
`_test` automatically) is already configured and has the full schema
migrated as of Phase 2 — integration tests can run against it (`NODE_ENV=test
npm run migrate` if it's ever out of date). `DEVELOPMENT_STATUS.md` tracks
what has actually been written, phase by phase — each feature phase must add
its corresponding tests before being marked complete (per spec section 52).

## Running Tests

```bash
cd backend
npm test
```

(Frontend test tooling — component/E2E — will be decided and documented here
when the frontend feature work begins; not required for Phase 1 foundation.)
