# API

## Base Path

`/api/v1`

## Response Envelope

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Something went wrong",
  "errorCode": "SOME_ERROR_CODE",
  "errors": []
}
```

All endpoints must return this envelope via the centralized response
helper/error middleware — controllers must not hand-roll response shapes.

## Error Codes

Centralized in `backend/src/constants/errorCodes.ts`. Canonical list (extend,
don't duplicate, as new modules are built):

```
AUTH_OTP_INVALID, AUTH_OTP_EXPIRED, AUTH_UNAUTHORIZED

TEST_NOT_FOUND, TEST_NOT_PUBLISHED, TEST_NOT_AVAILABLE, TEST_VALIDATION_FAILED

ATTEMPT_NOT_FOUND, ATTEMPT_ALREADY_ACTIVE, ATTEMPT_EXPIRED,
ATTEMPT_ALREADY_SUBMITTED, ATTEMPT_LIMIT_EXCEEDED

QUESTION_NOT_FOUND, QUESTION_NOT_APPROVED, QUESTION_VERSION_INVALID,
INVALID_OPTION

ORDER_NOT_FOUND, ORDER_ALREADY_PAID, IDEMPOTENCY_CONFLICT

PAYMENT_NOT_FOUND, PAYMENT_VERIFICATION_FAILED, PAYMENT_WEBHOOK_INVALID

ENTITLEMENT_NOT_FOUND, ENTITLEMENT_EXPIRED

AI_JOB_NOT_FOUND, AI_GENERATION_FAILED

FORBIDDEN, VALIDATION_ERROR, INTERNAL_ERROR
```

## Endpoints (Planned per Spec — Status Tracked in DEVELOPMENT_STATUS.md)

None of these are implemented yet as of Phase 1. Listed here as the contract to
build toward.

### Auth

```
POST /auth/request-otp
POST /auth/verify-otp
GET  /auth/me
POST /auth/logout
```

### Student

```
GET  /tests
GET  /tests/:testId
POST /tests/:testId/attempts

GET  /attempts/:attemptId
PUT  /attempts/:attemptId/questions/:attemptQuestionId/answer
POST /attempts/:attemptId/submit
GET  /attempts/:attemptId/result
```

### Commerce (Student-Facing)

```
GET  /products
POST /orders
GET  /orders/:id
POST /payments/create
POST /payments/webhook
GET  /entitlements
```

### Admin

Permission-gated (see `AUTHENTICATION.md`), covering: categories, competitive
exams, test series, subjects, topics, questions, question review, tests, test
sections, test questions, test rules, test validation, publish/close/archive,
products, prices, orders, payments, students, attempts, results, AI generation,
AI job status, settings. Concrete route list will be filled in as each admin
module is implemented, module by module, rather than speculatively listed here.

## Conventions

- Every mutating admin endpoint that changes question/test/product/pricing/
  entitlement/result-release/role state must write an `audit_logs` row (see
  `SECURITY.md`).
- List endpoints accept pagination via query params (`page`, `pageSize`) and
  return pagination info in `meta`.
- Validation happens at the boundary (controller/middleware) using `zod`
  schemas in `src/validations/`; services assume validated input.
