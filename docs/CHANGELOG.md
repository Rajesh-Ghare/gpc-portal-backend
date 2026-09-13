# Changelog

## Unreleased

### Added

- Initial repository structure: `backend/` (Node.js + Express + TypeScript +
  Sequelize) and `frontend/` (React + Vite + TypeScript).
- Full `docs/` documentation system and root `CLAUDE.md`.
- Backend TypeScript, ESLint, and Prettier configuration.
- Backend `.env.example` and frontend `.env.example`.
- Sequelize CLI configuration (`.sequelizerc`) and empty
  `migrations/`/`seeders/` directories, ready for Phase 2.
- Git repository initialized.
- Express app bootstrap with helmet/cors/morgan, standard response envelope,
  centralized error-code catalog and error-handling middleware, `/health`
  check, and `/api/v1` router mount.
- Backend smoke test (Vitest + Supertest) verifying `/health`.
- Frontend feature-module directory skeleton
  (`app/components/features/hooks/services/stores/questionTypes/utils/
  constants/validations/permissions`) and added `react-router-dom`,
  `@tanstack/react-query`, `zustand`, `axios`.
- Full database schema: 43 migrations (pgcrypto + 41 tables + one deferred
  FK) covering auth, exam catalog, question bank, test assembly, attempt
  engine, results, commerce, AI, and system domains. Verified via a full
  `migrate:undo:all` + `migrate` round trip against a real PostgreSQL
  database.
- 41 corresponding TypeScript Sequelize models (`src/models/`) with full
  associations wired in `src/models/index.ts`.
- A partial unique index preventing more than one `IN_PROGRESS` attempt per
  user/test, and a `CHECK` constraint on `product_items` enforcing the
  correct target column for each `access_type` — both verified against the
  real database, not just written.
- 6 development seeders providing roles/permissions, 3 sample users
  (SUPER_ADMIN/ADMIN/STUDENT), SSC/SSC CGL catalog data, Quantitative
  Aptitude subject/topics, 4 sample questions, 1 sample test, and 1 sample
  product — all with working `down()` migrations.
- Split `tsconfig.json` into a type-checking config (includes tests) and
  `tsconfig.build.json` (production build, `src/` only), fixing a latent
  `rootDir` conflict from Phase 1 that `tsc -p tsconfig.json` would have hit.
- Mobile OTP authentication: `OtpProvider`/`MockOtpProvider`, `authService`
  (request/verify OTP, find-or-create user with default STUDENT role, opaque
  SHA-256-hashed session tokens), `authenticate`/`requirePermission`
  middleware, and the `POST /auth/request-otp`, `POST /auth/verify-otp`,
  `GET /auth/me`, `POST /auth/logout` routes. Verified manually against a
  live server/database (including exhausting the OTP attempt limit) and via
  5 new automated integration tests.
- Exam catalog admin CRUD: 15 routes under `/api/v1/admin` for categories,
  competitive exams, and test series, gated by a new `catalog.*` permission
  family (view/create/update/delete). Includes slug auto-generation,
  duplicate-slug rejection, FK validation (exam→category, series→exam), and
  soft-delete. First real use of the `requirePermission` middleware
  (implemented in Phase 3, unused until now) — verified both directions via
  6 new integration tests.
- Question bank admin CRUD: subjects/topics (`subject.*` permission family,
  ADR-022), and a transactional question-authoring service that atomically
  creates a question with its first version, translations, options, and
  tags. Editing a question's content always creates a new version rather
  than mutating one in place (ADR-023), preserving the guarantee that a
  student's in-progress/completed attempt never sees content change
  underneath it. MCQ_SINGLE options are validated (exactly one correct
  option). Approve/reject review workflow. First real use of `audit_logs`
  (`question.approve`/`.reject`/`.version_created`, per spec section 46).
  Verified manually and via 7 new integration tests.
- Test builder admin CRUD: full test lifecycle
  (DRAFT→PUBLISHED→CLOSED→ARCHIVED), sections, manual `test_questions`
  assignment (rejects unapproved questions — first real use of
  `QUESTION_NOT_APPROVED`), and `test_rules`/`test_rule_tags` (rule-based
  selection config). A test's structure is only editable while `DRAFT`
  (ADR-024). `validateTest()` checks MANUAL tests have questions and
  RULE_BASED tests' rules are actually satisfiable against the real
  approved-question pool; `publishTest()` runs it and persists the computed
  totals. Extends `audit_logs` to `test.publish`/`test.close`. Verified
  manually and via 5 new integration tests.
- Exam engine (attempts): full lifecycle — `POST /tests/:id/attempts`
  (manual + rule-based question selection and snapshotting, entitlement +
  attempt-policy enforcement, one-transaction creation), answer autosave,
  backend-authoritative timer with verified auto-submit-on-expiry,
  transactional idempotent submission with MCQ_SINGLE evaluation
  (hand-verified scoring), and result retrieval respecting a test's
  visibility flags. `GET /tests`/`GET /tests/:id` for published-test
  browsing. First real use of the policy layer
  (`src/policies/attemptPolicy.ts`) for data-scoped (not permission-code)
  authorization. Verified manually (including a real-clock timer-expiry
  test) and via 5 new integration tests, one of which directly exercises
  the Phase 2 `attempts` partial unique index at the database level.
- Minimal admin entitlement grant (`POST /admin/entitlements`,
  `entitlement.grant` permission), built ahead of full Commerce at the
  project owner's explicit request: uses the real `products`/
  `product_items`/`entitlements` tables, is idempotent, and is
  audit-logged. See ADR-025.
- Results: rank/percentile computation (`src/utils/rankings.ts`, standard
  competition ranking with ties, unit-tested) wired into an idempotent
  `POST /admin/tests/:testId/results/release` admin action
  (`result.release` permission, audit-logged). Admin browsing of any
  student's attempts (`GET /admin/attempts`, `GET /admin/attempts/:id`,
  `attempt.view`) and results (`GET /admin/tests/:testId/results`,
  `GET /admin/results/:id`, `result.view`) built as deliberately separate
  serializer functions from the student-facing ones — see ADR-030.
  Verified with 3 real students producing a real tie (rank/percentile
  matched by hand) and via 11 new tests (5 unit, 6 integration).
- Commerce: full admin product/price/item CRUD extending Phase 7's
  deliberately narrow `productRepository.ts` (`product.view`/`.create`/
  `.update`), student-facing `GET /products`/`GET /products/:id`, and an
  idempotent single-product order flow (`POST /orders`, `GET /orders`,
  `GET /orders/:id`) that snapshots product name + current active price
  into `order_items` and never re-reads pricing later (ADR-031 explains
  why `order_items` is per-product, not per-`product_item`). Closed the
  Phase 7 (ADR-025) gap: `GET /admin/entitlements` (list/filter) and
  `DELETE /admin/entitlements/:id` (idempotent revoke), verified to
  actually block a subsequent attempt-start. Product-item target/access-type
  validation is enforced at the service layer (matching the existing DB
  `CHECK` constraint) as well as the database. Every product-price change
  is audit-logged (`product.price_changed`). Verified manually end-to-end
  and via 14 new integration tests.
- Payments: a `PaymentGateway` interface (ADR-006) with a `MockPaymentGateway`
  that HMAC-signs/verifies real webhook payloads rather than bypassing
  verification. `POST /payments/create` (idempotent, rejects an
  already-PAID order) and `POST /payments/webhook` (no session auth —
  signature-verified instead) — the only code path that can mark an order
  PAID and create entitlements from a purchase, running signature
  verification, event-replay dedup, and order-total re-verification before
  any mutation. `POST /payments/:paymentId/simulate` (mock-provider-only)
  reuses that exact same webhook-processing function via a real signed
  payload rather than a parallel shortcut (ADR-032), so "purchase using
  mock payment -> entitlement created" is exercised identically to a real
  provider integration. Purchase-created entitlements are marked
  `metadata.source: 'PURCHASE'` with `grantedBy: null` (vs. an admin
  grant's `ADMIN_GRANT`/adminId) and still audit-logged. Verified manually
  end-to-end (including a hand-signed tampered-amount payload proving
  amount verification isn't decorative) and via 10 new integration tests.
- AI: an `AIService` interface (ADR-006) with a `MockAIProvider`
  implementing all five documented methods, though only `generateQuestions`
  is wired to an endpoint. `POST /admin/ai/jobs` runs generation
  synchronously, creating one `ai_generation_items` row per candidate
  (flagging an exact-normalized-text duplicate match against approved
  questions in the same subject) and marking the job COMPLETED/FAILED.
  `POST /admin/ai/jobs/:jobId/items/:itemId/approve` creates a real
  question through the exact same `questionService.createQuestion()`/
  `approveQuestion()` path manual authoring uses (no parallel "AI
  question" path — ADR-033) and stamps it with AI provenance via an
  internal-only parameter no client request can forge; `.../reject`
  records a reason and creates nothing. `ai.generate` (seeded since Phase
  1, unused until now) is the only permission the module needs. Verified
  manually end-to-end (including confirming AI metadata never reaches a
  student-facing attempt payload) and via 6 new integration tests.
- Student Frontend (Phase 12, code in the companion `gpc-portal-frontend`
  repo): the full student journey against the real API — OTP login, test
  browsing, the exam-taking UI (server-expiry-driven timer, question
  navigator, a question-renderer registry per `docs/EXAM_ENGINE.md`),
  results, a marketplace, and the order → mock-payment → entitlement
  purchase flow. See `docs/FRONTEND.md` for the as-built structure and
  `docs/DEVELOPMENT_STATUS.md` for this phase's full notes, including a
  real-browser end-to-end verification pass that caught and fixed one
  frontend bug (a broken "answered" counter).

### Changed

- Split the project into two separate git repositories, `gpc-portal-backend`
  (this repo — now also owns the full `docs/`/`CLAUDE.md`) and
  `gpc-portal-frontend`, rather than one monorepo (ADR-016). `docs/`,
  `CLAUDE.md`, and the root `README.md` moved from the shared parent folder
  into this repo; `gpc-portal-frontend` got its own short README pointing
  back here.
- `src/config/env.ts` now appends `_test` to the database name under
  `NODE_ENV=test`, matching `sequelize-cli.js`'s existing behavior — the app
  and the CLI were previously inconsistent about which database
  `NODE_ENV=test` pointed at.
- Integration tests now run sequentially (`vitest.config.mts` →
  `fileParallelism: false`), fixing a race where test files sharing one real
  database and the same seeded users could grab each other's OTP requests.

### Fixed

- Deeply nested Sequelize `include` chains (4+ levels — attempt →
  attempt_questions → question_version → options → translations) were
  silently corrupting field names: PostgreSQL truncates column aliases
  over 63 bytes, and Sequelize was mapping values onto the truncated
  (wrong) attribute names with no error thrown. Fixed with `separate: true`
  on the nested associations. See ADR-028.
- `GET /attempts/:attemptId` never returned each question's `questionType`
  — `getAttemptDetail()` eager-loaded `questionVersion` but never the
  parent `Question` row that actually holds it, so the frontend's
  documented question-renderer registry (`docs/EXAM_ENGINE.md`) had no way
  to know which component to render. Found while starting Phase 12
  (Student Frontend); fixed by eager-loading `question` alongside
  `questionVersion` in `attemptRepository.findAttemptWithQuestions()` and
  including `questionType` in the serialized response.
- `GET /auth/me` never returned permission codes, only role codes — the
  admin frontend's originally-documented permission-based UI helpers
  (`docs/FRONTEND.md`'s `src/permissions/`) had nothing to read. Found
  while starting Phase 13 (Admin Frontend); fixed by adding a flattened,
  deduped `permissions: string[]` field, resolved the same way
  `requirePermission()` already does but confined to this one endpoint.

### Security

- Fixed a real bug found during Phase 7 manual testing: `POST
  /tests/:id/attempts`'s response leaked `is_correct`/`correct_option_id`
  on every option (it built its response from a raw eager-loaded query
  instead of the sanitizing serializer `GET /attempts/:id` already used).
  There is now exactly one code path that serializes attempt-question data
  for a student.

### Database

- Full schema implemented: 41 tables + `pgcrypto` extension. See
  `docs/DATABASE.md` for the complete migration list and integrity rules.

### Documentation

- Created `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`,
  `docs/DATABASE.md`, `docs/API.md`, `docs/FRONTEND.md`,
  `docs/EXAM_ENGINE.md`, `docs/AUTHENTICATION.md`,
  `docs/COMMERCE_AND_PAYMENTS.md`, `docs/AI.md`, `docs/SECURITY.md`,
  `docs/DEPLOYMENT.md`, `docs/TESTING.md`, `docs/DECISIONS.md`
  (ADR-001 through ADR-033), `docs/KNOWN_ISSUES.md`,
  `docs/DEVELOPMENT_STATUS.md`, and root `CLAUDE.md`.
- `docs/DATABASE.md` rewritten to describe the as-built schema (migration
  order, integrity rules, seeding, and modeling decisions made where the
  spec was ambiguous).
- `docs/AUTHENTICATION.md` rewritten for the as-built auth flow;
  `docs/API.md` updated with implemented auth, catalog, question-bank,
  test-builder, exam-engine, entitlement-grant, and admin results/attempts
  endpoint shapes; `docs/SECURITY.md`'s Auditability section and Required
  Security Test Coverage checklist updated to reflect the now-implemented
  (and intentionally scoped) audit logging, what's actually been tested,
  and the admin-view exception; `docs/EXAM_ENGINE.md` rewritten end to end
  for the as-built engine, including the two bugs found during Phase 7 and
  a new Rank & Percentile section; `docs/COMMERCE_AND_PAYMENTS.md` updated
  for the implemented entitlement resolution and admin-grant override.
- `docs/COMMERCE_AND_PAYMENTS.md`, `docs/API.md`, `docs/AUTHENTICATION.md`,
  `docs/SECURITY.md` updated for Phase 9's implemented product/price/item/
  order/entitlement-revoke endpoints; `docs/DECISIONS.md` gained ADR-031
  (order_items is per-product, not per-product_item); `docs/KNOWN_ISSUES.md`
  resolved the entitlement list/revoke item and added order-cancellation
  and pagination items.
- `docs/COMMERCE_AND_PAYMENTS.md`'s Payment Flow section rewritten for the
  as-built webhook verification sequence; `docs/API.md` gained the
  `/payments/*` endpoints; `docs/SECURITY.md`'s Payment Security section
  and Required Security Test Coverage checklist updated for the
  now-implemented (and tested) signature/replay/amount verification;
  `docs/DECISIONS.md` gained ADR-032 (mock payment confirmation reuses the
  real webhook handler); `docs/KNOWN_ISSUES.md` added the "no real
  PaymentGateway yet" and "mock signs parsed body, not raw bytes" items.
- `docs/AI.md` rewritten end to end for the as-built generation-job/review
  workflow; `docs/API.md` gained the `/admin/ai/*` endpoints;
  `docs/AUTHENTICATION.md` documents `ai.generate`'s activation and its
  deliberate single-permission scope; `docs/SECURITY.md`'s Auditability
  section and Required Security Test Coverage checklist updated for the
  AI-review guarantees; `docs/DECISIONS.md` gained ADR-033 (AI-approved
  questions reuse `createQuestion()`, provenance passed out-of-band);
  `docs/KNOWN_ISSUES.md` added the synchronous-generation, unwired-
  interface-methods, and simple-duplicate-detection items.
