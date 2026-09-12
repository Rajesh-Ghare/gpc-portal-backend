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

Centralized in `src/errors/errorCodes.ts`. Canonical list (extend,
don't duplicate, as new modules are built):

```
AUTH_OTP_INVALID, AUTH_OTP_EXPIRED, AUTH_UNAUTHORIZED

CATEGORY_NOT_FOUND, EXAM_NOT_FOUND, SERIES_NOT_FOUND, DUPLICATE_SLUG

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

## Endpoints (Status Tracked in DEVELOPMENT_STATUS.md)

### Auth — Implemented (Phase 3)

```
POST /auth/request-otp   { mobileNumber: string (10 digits) }
                          → { mobileNumber, expiresAt }

POST /auth/verify-otp    { mobileNumber: string, otp: string (6 digits) }
                          → { token, user: { id, mobileNumber, fullName, status } }
                          errorCode AUTH_OTP_EXPIRED  — no active OTP request found
                          errorCode AUTH_OTP_INVALID  — wrong code, or attempt limit exceeded

GET  /auth/me             (Authorization: Bearer <token>)
                          → { id, mobileNumber, email, fullName, status, roles: string[] }
                          errorCode AUTH_UNAUTHORIZED — missing/invalid/expired/revoked token

POST /auth/logout         (Authorization: Bearer <token>)
                          → {} — revokes the current session
```

Everything else below is planned but not yet implemented; listed here as the
contract to build toward.

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

Permission-gated (see `AUTHENTICATION.md`). Concrete routes are filled in as
each admin module is implemented, module by module.

#### Exam Catalog — Implemented (Phase 4)

All routes require `Authorization: Bearer <token>` plus the named
permission (`catalog.view`/`catalog.create`/`catalog.update`/
`catalog.delete`). Categories/exams/series are soft-deleted (`deleted_at`
set via Sequelize's `paranoid: true`; `DELETE` returns 200, a subsequent
`GET` returns 404 with the entity-specific `*_NOT_FOUND` code, since
paranoid models exclude soft-deleted rows from normal queries by default).

```
GET    /admin/categories                 requires catalog.view
GET    /admin/categories/:id             requires catalog.view
POST   /admin/categories                 requires catalog.create
                                          { name, slug?, description?, displayOrder?, isActive? }
                                          slug auto-generated from name if omitted
PUT    /admin/categories/:id             requires catalog.update  (partial body)
DELETE /admin/categories/:id             requires catalog.delete

GET    /admin/exams?categoryId=          requires catalog.view
GET    /admin/exams/:id                  requires catalog.view
POST   /admin/exams                      requires catalog.create
                                          { categoryId, name, slug?, code?, description?,
                                            conductingBody?, officialWebsite?, isActive? }
                                          errorCode CATEGORY_NOT_FOUND if categoryId doesn't exist
PUT    /admin/exams/:id                  requires catalog.update  (partial body)
DELETE /admin/exams/:id                  requires catalog.delete

GET    /admin/series?competitiveExamId=  requires catalog.view
GET    /admin/series/:id                 requires catalog.view
POST   /admin/series                     requires catalog.create
                                          { competitiveExamId?, name, slug?, description?,
                                            thumbnailUrl?, displayOrder?, isActive? }
                                          errorCode EXAM_NOT_FOUND if competitiveExamId given but doesn't exist
PUT    /admin/series/:id                 requires catalog.update  (partial body)
DELETE /admin/series/:id                 requires catalog.delete
```

Everything else in this section (subjects, topics, questions, question
review, tests, test sections, test rules, test validation,
publish/close/archive, products, prices, orders, payments, students,
attempts, results, AI generation, AI job status, settings) is planned but
not yet implemented.

## Conventions

- Every mutating admin endpoint that changes question/test/product/pricing/
  entitlement/result-release/role state must write an `audit_logs` row (see
  `SECURITY.md`).
- List endpoints accept pagination via query params (`page`, `pageSize`) and
  return pagination info in `meta`.
- Validation happens at the boundary (controller/middleware) using `zod`
  schemas in `src/validations/`; services assume validated input.
