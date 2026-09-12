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

TEST_NOT_FOUND, TEST_NOT_PUBLISHED, TEST_NOT_AVAILABLE, TEST_VALIDATION_FAILED,
TEST_NOT_EDITABLE, TEST_INVALID_STATUS_TRANSITION

ATTEMPT_NOT_FOUND, ATTEMPT_ALREADY_ACTIVE, ATTEMPT_EXPIRED,
ATTEMPT_ALREADY_SUBMITTED, ATTEMPT_LIMIT_EXCEEDED

SUBJECT_NOT_FOUND, TOPIC_NOT_FOUND

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

#### Question Bank — Implemented (Phase 5)

All routes require `Authorization: Bearer <token>` plus the named
permission. Subjects/topics soft-delete like the catalog entities above.

```
GET    /admin/subjects                   requires subject.view
GET    /admin/subjects/:id               requires subject.view
POST   /admin/subjects                   requires subject.create
                                          { name, slug?, description?, isActive? }
PUT    /admin/subjects/:id               requires subject.update  (partial body)
DELETE /admin/subjects/:id               requires subject.delete

GET    /admin/topics?subjectId=          requires subject.view
GET    /admin/topics/:id                 requires subject.view
POST   /admin/topics                     requires subject.create
                                          { subjectId, parentTopicId?, name, slug?, description?, isActive? }
                                          errorCode SUBJECT_NOT_FOUND; VALIDATION_ERROR if
                                          parentTopicId belongs to a different subject
PUT    /admin/topics/:id                 requires subject.update  (partial body)
DELETE /admin/topics/:id                 requires subject.delete

GET    /admin/questions?subjectId=&topicId=&status=&reviewStatus=
                                          requires question.view
GET    /admin/questions/:id              requires question.view
                                          → { question: {...}, latestVersion: {...} }
POST   /admin/questions                  requires question.create
                                          { subjectId, topicId?, questionType?, difficulty?,
                                            defaultLanguageCode?, tags?: string[],
                                            marks?, negativeMarks?, explanation?, solutionSteps?,
                                            translations: [{ languageCode, questionText, explanation?, solutionSteps? }],
                                            options: [{ optionKey, isCorrect?, numericValue?,
                                                        translations: [{ languageCode, optionText }] }] }
                                          Creates the question + its version 1 + translations +
                                          options + tags in ONE transaction (see ADR-023).
                                          errorCode SUBJECT_NOT_FOUND / QUESTION_VERSION_INVALID
                                          (e.g. MCQ_SINGLE without exactly one correct option)
PUT    /admin/questions/:id              requires question.update
                                          { subjectId?, topicId?, questionType?, difficulty?, tags? }
                                          Metadata only — does NOT create a new version (ADR-023)
POST   /admin/questions/:id/versions     requires question.update
                                          Same body shape as the version-content fields of POST
                                          /admin/questions above. Creates a new version, bumps
                                          questions.version, writes an audit_logs row
                                          (action: question.version_created)
POST   /admin/questions/:id/approve      requires question.approve
                                          → reviewStatus=APPROVED, status=PUBLISHED; audit-logged
                                          (action: question.approve)
POST   /admin/questions/:id/reject       requires question.reject
                                          { reason?: string }
                                          → reviewStatus=REJECTED; audit-logged (action: question.reject)
DELETE /admin/questions/:id              requires question.update (no separate question.delete code)
```

#### Test Builder — Implemented (Phase 6)

All routes require `Authorization: Bearer <token>` plus the named
permission. A test's structure (sections/questions/rules/basic info) is only
mutable while `status=DRAFT` (`errorCode TEST_NOT_EDITABLE`, 409, otherwise
— see ADR-024). `test_sections` are hard-deleted (no `deleted_at` column);
`tests` soft-deletes like other paranoid catalog entities.

```
GET    /admin/tests?competitiveExamId=&testSeriesId=&status=
                                          requires test.view
GET    /admin/tests/:testId              requires test.view
                                          → test row + sections + testQuestions + testRules(+tags)
POST   /admin/tests                      requires test.create
                                          { competitiveExamId, testSeriesId?, title, slug?,
                                            description?, instructions?, testType?, durationSeconds,
                                            passingMarks?, defaultMarksPerQuestion?, defaultNegativeMarks?,
                                            selectionMode? ('MANUAL'|'RULE_BASED'), randomizeQuestions?,
                                            randomizeOptions?, attemptPolicy?, resultVisibility?,
                                            showScore?, showCorrectAnswers?, showExplanations?,
                                            showRank?, showPercentile?, availableFrom?, availableUntil?,
                                            requiredLanguages? }
PUT    /admin/tests/:testId              requires test.update  (DRAFT only; partial body)
DELETE /admin/tests/:testId              requires test.update  (DRAFT only)
GET    /admin/tests/:testId/validate     requires test.validate
                                          → { valid, errors: string[], computedTotals: { totalQuestions, totalMarks } }
POST   /admin/tests/:testId/publish      requires test.publish
                                          Runs validate first (422 TEST_VALIDATION_FAILED with the
                                          error list if invalid); on success sets status=PUBLISHED,
                                          recomputes total_questions/total_marks from the actual
                                          assembled content, audit-logged (action: test.publish)
POST   /admin/tests/:testId/close        requires test.close
                                          PUBLISHED → CLOSED only; audit-logged (action: test.close)
POST   /admin/tests/:testId/archive      requires test.close (no separate test.archive code — ADR-024)
                                          DRAFT or CLOSED → ARCHIVED only; NOT audit-logged

GET    /admin/tests/:testId/sections            requires test.view
POST   /admin/tests/:testId/sections            requires test.update (DRAFT only)
                                                 { title, description?, displayOrder?, durationSeconds?,
                                                   marksPerQuestion?, negativeMarks? }
PUT    /admin/tests/:testId/sections/:id        requires test.update (DRAFT only; partial body)
DELETE /admin/tests/:testId/sections/:id        requires test.update (DRAFT only)

GET    /admin/tests/:testId/questions           requires test.view
POST   /admin/tests/:testId/questions           requires test.update (DRAFT only)
                                                 { questionId, questionVersionId?, sectionId?,
                                                   displayOrder?, marks?, negativeMarks? }
                                                 errorCode QUESTION_NOT_APPROVED if the question's
                                                 reviewStatus isn't APPROVED; questionVersionId
                                                 defaults to the question's latest version;
                                                 marks/negativeMarks default to the version's own,
                                                 falling back to the test's defaults
DELETE /admin/tests/:testId/questions/:id       requires test.update (DRAFT only)

GET    /admin/tests/:testId/rules               requires test.view
POST   /admin/tests/:testId/rules               requires test.update (DRAFT only)
                                                 { sectionId?, subjectId?, topicId?, questionType?,
                                                   difficulty?, languageCode?, questionCount,
                                                   selectionStrategy?, displayOrder?, ruleConfig?,
                                                   tags?: string[] }
PUT    /admin/tests/:testId/rules/:id           requires test.update (DRAFT only; partial body)
DELETE /admin/tests/:testId/rules/:id           requires test.update (DRAFT only)
```

Everything else in this section (products, prices, orders, payments,
students, attempts, results, AI generation, AI job status, settings) is
planned but not yet implemented.

## Conventions

- Every mutating admin endpoint that changes question/test/product/pricing/
  entitlement/result-release/role state must write an `audit_logs` row (see
  `SECURITY.md`).
- List endpoints accept pagination via query params (`page`, `pageSize`) and
  return pagination info in `meta`.
- Validation happens at the boundary (controller/middleware) using `zod`
  schemas in `src/validations/`; services assume validated input.
