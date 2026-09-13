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

PRODUCT_NOT_FOUND

ORDER_NOT_FOUND, ORDER_ALREADY_PAID, IDEMPOTENCY_CONFLICT

PAYMENT_NOT_FOUND, PAYMENT_VERIFICATION_FAILED, PAYMENT_WEBHOOK_INVALID

ENTITLEMENT_NOT_FOUND, ENTITLEMENT_EXPIRED

AI_JOB_NOT_FOUND, AI_GENERATION_FAILED

USER_NOT_FOUND, RESULT_NOT_RELEASED, RESULT_NOT_FOUND

FORBIDDEN, VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR
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
                          → { id, mobileNumber, email, fullName, status, roles: string[],
                              permissions: string[] }
                          permissions is the flattened, deduped set of permission
                          codes across all the user's roles (added Phase 13, for the
                          admin frontend's permission-based show/hide — see
                          docs/AUTHENTICATION.md; still UX-only, every action is
                          re-checked server-side via requirePermission)
                          errorCode AUTH_UNAUTHORIZED — missing/invalid/expired/revoked token

POST /auth/logout         (Authorization: Bearer <token>)
                          → {} — revokes the current session
```

### Student (Test Browsing & Attempts) — Implemented (Phase 7)

Per spec section 2's flow (login happens before browsing), every route
below requires `Authorization: Bearer <token>` but no admin permission —
just a valid session. Attempt-specific routes additionally check ownership
(`attemptPolicy.ensureOwnsAttempt`, `errorCode FORBIDDEN` if the attempt
belongs to someone else) rather than a permission code.

```
GET  /tests                              → published tests only, within
                                            their availableFrom/availableUntil
                                            window if set
GET  /tests/:testId                      → a single published test
                                            errorCode TEST_NOT_FOUND if not published

POST /tests/:testId/attempts             → creates (or resumes an existing
                                            IN_PROGRESS) attempt, with its
                                            frozen attempt_questions (options
                                            include text but never isCorrect
                                            — see docs/SECURITY.md)
                                            errorCode ENTITLEMENT_NOT_FOUND — no active entitlement
                                            errorCode ATTEMPT_LIMIT_EXCEEDED — SINGLE policy already
                                              used, or entitlement's attempt_limit reached
                                            errorCode TEST_NOT_AVAILABLE — RULE_BASED test's rules
                                              can't currently be satisfied

GET  /attempts/:attemptId                → status, remainingSeconds (computed,
                                            never trust a client clock), and
                                            questions[] (each with questionType,
                                            for the frontend's renderer registry
                                            — see EXAM_ENGINE.md; no correctness
                                            data) — auto-submits first if expired

PUT  /attempts/:attemptId/questions/:attemptQuestionId/answer
                                          { selectedOptionId?, answerText?, numericAnswer?, isMarkedForReview? }
                                          errorCode INVALID_OPTION — option doesn't belong to this question
                                          errorCode ATTEMPT_EXPIRED — time ran out (auto-submitted just now)
                                          errorCode ATTEMPT_ALREADY_SUBMITTED — already explicitly submitted

POST /attempts/:attemptId/submit         → evaluates (MCQ_SINGLE today — see
                                            docs/EXAM_ENGINE.md), creates
                                            results + result_details,
                                            idempotent (resubmitting returns
                                            the same result, doesn't recompute)

GET  /attempts/:attemptId/result         → shape depends on the test's
                                            show_score/show_correct_answers/
                                            show_rank/show_percentile flags
                                            errorCode RESULT_NOT_RELEASED — result_visibility isn't
                                              IMMEDIATE and no released_at is set yet (Phase 8)
```

### Commerce (Student-Facing) — Products/Orders (Phase 9), Payments (Phase 10)

Every route requires `Authorization: Bearer <token>` but no admin
permission — just a valid session. Order ownership is enforced by
`orderPolicy.ensureOwnsOrder` (`errorCode FORBIDDEN`), not a permission
code, mirroring `attemptPolicy`.

```
GET  /products                           → ACTIVE + isActive products only, with prices
GET  /products/:productId                → single ACTIVE product, with prices + items
                                            errorCode PRODUCT_NOT_FOUND

POST /orders                             { productId, idempotencyKey }
                                          → creates a PENDING order, snapshotting the
                                            product's name and current active price into
                                            one order_item (never re-priced later — see
                                            docs/COMMERCE_AND_PAYMENTS.md)
                                          → 201 on first call; 200 + the same order if
                                            (userId, idempotencyKey) repeats with the same
                                            productId (idempotent)
                                          errorCode PRODUCT_NOT_FOUND — missing/not ACTIVE
                                          errorCode NOT_FOUND — product has no active price
                                          errorCode IDEMPOTENCY_CONFLICT — same key reused
                                            with a different productId
GET  /orders                             → the current user's own orders
GET  /orders/:orderId                    → a single order (must be the requester's own)
                                          errorCode ORDER_NOT_FOUND / FORBIDDEN

POST /payments/create                    { orderId }
                                          → creates (or returns the existing PENDING)
                                            payment via the configured PaymentGateway
                                          errorCode ORDER_ALREADY_PAID / ORDER_NOT_FOUND / FORBIDDEN
POST /payments/webhook                   NO session auth — the caller is the payment
                                          provider, authenticated by signature, not a
                                          token. See docs/COMMERCE_AND_PAYMENTS.md for
                                          the full verify → dedupe → verify-amount →
                                          mark-paid → create-entitlements sequence.
                                          errorCode PAYMENT_WEBHOOK_INVALID / PAYMENT_NOT_FOUND /
                                            PAYMENT_VERIFICATION_FAILED
POST /payments/:paymentId/simulate       { outcome?: 'PAID' | 'FAILED' }  (default PAID)
                                          Dev/test-only: builds a signed mock webhook
                                          payload and routes it through the real
                                          POST /payments/webhook verification path.
                                          errorCode NOT_FOUND unless PAYMENT_PROVIDER=mock
```

`GET /entitlements` (a student-facing "my entitlements" view) is not yet
built — see `docs/KNOWN_ISSUES.md`.

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

#### Commerce — Products/Prices/Items/Orders Implemented (Phase 9)

All routes require `Authorization: Bearer <token>` plus `product.*`/
`order.view`. Products soft-delete (`paranoid: true`, like catalog
entities); prices and items are hard-deleted. Every product-price create/
update/delete writes an `audit_logs` row (action `product.price_changed`)
per spec section 46 — plain product/item CRUD is deliberately not audited
(not in the spec's list).

```
GET    /admin/products?productType=&status=     requires product.view
GET    /admin/products/:id                      requires product.view
                                                 → product + its prices + items
POST   /admin/products                          requires product.create
                                                 { name, slug?, description?, productType,
                                                   status?, displayOrder?, isActive? }
PUT    /admin/products/:id                      requires product.update  (partial body)
DELETE /admin/products/:id                      requires product.update  (soft delete)

GET    /admin/products/:id/prices               requires product.view
POST   /admin/products/:id/prices               requires product.update
                                                 { currencyCode?, amount, originalAmount?,
                                                   taxAmount?, validFrom?, validUntil?, isActive? }
                                                 Audit-logged (action: product.price_changed)
PUT    /admin/products/:id/prices/:priceId      requires product.update  (partial body)
                                                 Audit-logged (action: product.price_changed)
DELETE /admin/products/:id/prices/:priceId      requires product.update
                                                 Audit-logged (action: product.price_changed)

GET    /admin/products/:id/items                requires product.view
POST   /admin/products/:id/items                requires product.update
                                                 { accessType, testId? | testSeriesId? |
                                                   competitiveExamId? | subjectId?,
                                                   attemptLimit?, accessDurationDays? }
                                                 Validated against the same target-column/
                                                 access_type rule the DB CHECK constraint
                                                 enforces (ADR-018) — errorCode
                                                 VALIDATION_ERROR if they don't match
DELETE /admin/products/:id/items/:itemId        requires product.update

GET    /admin/orders?userId=&status=            requires order.view
GET    /admin/orders/:orderId                   requires order.view
                                                 errorCode ORDER_NOT_FOUND
```

#### Entitlements — Grant Implemented (Phase 7), List/Revoke Implemented (Phase 9)

Uses the real `products`/`product_items`/`entitlements` tables (ADR-025).

```
POST   /admin/entitlements               requires entitlement.grant
                                          { userId, testId? | productItemId?  (exactly one),
                                            attemptLimit?, validFrom?, validUntil?, reason? }
                                          → 201 + entitlement (new grant), or 200 + entitlement
                                            with message "An active entitlement already existed"
                                            (idempotent — never duplicates)
                                          errorCode USER_NOT_FOUND / TEST_NOT_FOUND / NOT_FOUND
                                            (productItemId given but doesn't exist)
                                          Audit-logged (action: entitlement.grant)
GET    /admin/entitlements?userId=&status=&productId=
                                          requires entitlement.view
DELETE /admin/entitlements/:id           requires entitlement.grant
                                          → sets status=REVOKED, revokedAt=now(); idempotent
                                            (revoking an already-revoked entitlement returns it
                                            unchanged, no duplicate audit entry)
                                          errorCode ENTITLEMENT_NOT_FOUND
                                          Audit-logged (action: entitlement.revoke)
```

#### Attempts & Results (Admin View) — Implemented (Phase 8)

Separate serializers from the student-facing attempt/result endpoints —
these show correctness data (`is_correct`/`correct_option_id`) that a
student is never shown for their own attempt. See ADR-030.

```
GET  /admin/attempts?testId=&userId=&status=  requires attempt.view
                                               → summary list with user + test joined
GET  /admin/attempts/:attemptId               requires attempt.view
                                               → full attempt detail, INCLUDING correctness
                                               errorCode ATTEMPT_NOT_FOUND

GET  /admin/tests/:testId/results             requires result.view
                                               → all results for the test (any release status),
                                                 ordered by scoredMarks desc, with user joined
GET  /admin/results/:id                       requires result.view
                                               → { result, details: result_details[] } — full
                                                 detail regardless of the test's show_* flags
                                               errorCode RESULT_NOT_FOUND

POST /admin/tests/:testId/results/release     requires result.release
                                               → recomputes rank/percentile for every EVALUATED
                                                 result (standard competition ranking — ties share
                                                 a rank, ADR-029), releases (sets releasedAt) any
                                                 not already released; safe to call repeatedly
                                               → { totalResults, releasedCount, alreadyReleasedCount }
                                               Audit-logged (action: result.release)
```

#### AI Question Generation — Implemented (Phase 11)

All routes require `Authorization: Bearer <token>` plus `ai.generate` (the
only permission this module uses). Generation runs synchronously within
`POST /admin/ai/jobs` — see `docs/AI.md`.

```
GET  /admin/ai/jobs?status=&subjectId=            requires ai.generate
GET  /admin/ai/jobs/:jobId                        requires ai.generate
                                                   → job row + items[]
                                                   errorCode AI_JOB_NOT_FOUND
POST /admin/ai/jobs                               requires ai.generate
                                                   { subjectId, topicId?, competitiveExamId?,
                                                     questionType?, difficulty?, languageCode?,
                                                     requestedCount (1-20) }
                                                   → job (status COMPLETED) + generated items
                                                   errorCode AI_GENERATION_FAILED (502) if the
                                                     provider itself throws
POST /admin/ai/jobs/:jobId/items/:itemId/approve  requires ai.generate
                                                   → creates + immediately publishes a real question
                                                     (questionService.createQuestion +
                                                     approveQuestion — same path as manual
                                                     authoring), stamped with AI provenance
                                                   errorCode VALIDATION_ERROR (409) if the item
                                                     isn't PENDING_REVIEW
                                                   Audit-logged (action: question.approve)
POST /admin/ai/jobs/:jobId/items/:itemId/reject   requires ai.generate
                                                   { reason?: string }
                                                   errorCode VALIDATION_ERROR (409) if the item
                                                     isn't PENDING_REVIEW
```

Everything else in this section (students, settings) is planned but not
yet implemented.

## Conventions

- Every mutating admin endpoint that changes question/test/product/pricing/
  entitlement/result-release/role state must write an `audit_logs` row (see
  `SECURITY.md`).
- List endpoints accept pagination via query params (`page`, `pageSize`) and
  return pagination info in `meta`.
- Validation happens at the boundary (controller/middleware) using `zod`
  schemas in `src/validations/`; services assume validated input.
