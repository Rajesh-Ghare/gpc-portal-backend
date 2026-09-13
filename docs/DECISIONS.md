# Architectural Decision Records

## ADR-001: Modular Monolith

Date: 2026-09-12
Status: Accepted

Decision:
Build the backend as a single Express application organized into domain modules
(auth, catalog, questions, tests, attempts, results, commerce, payments, ai,
system), rather than separate services.

Reason:
The V1 scope is a single-team, single-deployable product. Microservices add
operational overhead (service discovery, distributed transactions, network
failure handling) that is not justified until there is a concrete scaling or
team-boundary reason. A modular monolith with clean layering (controllers →
services → repositories) keeps the option to extract a service later without
paying the distributed-systems tax now.

Alternatives:
Microservices per domain — rejected as premature. Serverless functions per
endpoint — rejected, poor fit for stateful exam-timer/transactional workflows.

Consequences:
Module boundaries are enforced by convention and code review, not by process
isolation. Cross-module calls must go through the other module's service layer.

---

## ADR-002: PostgreSQL + Sequelize

Date: 2026-09-12
Status: Accepted

Decision:
Use PostgreSQL as the sole datastore, accessed via Sequelize ORM with the
migration-based workflow (no `sync({ alter: true })` / `sync({ force: true })`
against real data).

Reason:
The domain has strong relational structure (exams → tests → sections →
questions, attempts → attempt_questions → attempt_answers, orders → payments →
entitlements) with many uniqueness/foreign-key constraints that matter for data
integrity (e.g. one in-progress attempt per user/test). PostgreSQL's
transactional guarantees and partial unique indexes are used directly by the
attempt/payment workflows. Sequelize gives a mature TypeScript-friendly ORM with
first-class migrations.

Alternatives:
Prisma — considered, but Sequelize's migration model and repository-friendly
query API fit the existing team convention requested for this project. NoSQL —
rejected, the domain is fundamentally relational.

Consequences:
Schema changes always go through a migration file. Sequelize model definitions
must stay in sync with migrations; migrations are the source of truth.

---

## ADR-003: TypeScript for Backend and Frontend

Date: 2026-09-12
Status: Accepted

Decision:
Use TypeScript (strict mode) for both the Express backend and the React
frontend, as the project-wide language convention from the first commit.

Reason:
This is a production system with a large, interconnected data model (25+
tables spanning auth, catalog, questions, attempts, commerce, AI). Compile-time
checking of DTOs/API contracts and Sequelize model types materially reduces the
risk of data-integrity bugs, especially around scoring, entitlements, and
payment webhooks. Decided explicitly by the project owner at project start
(no prior convention existed).

Alternatives:
Plain JavaScript — faster initial setup, rejected in favor of long-term
maintainability for a project explicitly intended to outlive any single
developer or Claude Code session.

Consequences:
All new backend/frontend source files are `.ts`/`.tsx`. Shared DTO/types are
used where they genuinely improve API contract safety, without introducing
unnecessary abstraction layers (per project owner's explicit "do not
over-engineer" instruction).

---

## ADR-004: React + Vite Frontend

Date: 2026-09-12
Status: Accepted

Decision:
Use React with Vite as the build tool, React Router for routing, TanStack Query
for server state, and Zustand only where genuinely client-only state is needed
(e.g. exam-navigation UI state, not server data).

Reason:
Vite gives fast local dev feedback; TanStack Query removes the need for
hand-rolled server-state caching/invalidation, which matters for
autosave/attempt-status flows; Zustand is intentionally scoped narrowly to avoid
duplicating server state on the client.

Alternatives:
Next.js — rejected, no SSR/SEO requirement for the exam-taking product; adds
routing/data-fetching conventions not needed here. Redux — rejected as heavier
than needed given TanStack Query covers server state.

Consequences:
Server data must not be duplicated into Zustand stores "just in case" — if it
comes from the API, it lives in TanStack Query's cache.

---

## ADR-005: OTP-Based Authentication (Mobile Number as Primary Identity)

Date: 2026-09-12
Status: Accepted

Decision:
Primary authentication is mobile-number + OTP. Email/password fields exist on
`users` but are optional and not the primary V1 login path. OTPs are never
stored in plaintext (`otp_requests.otp_hash` only).

Reason:
Matches the initial distribution channel (Telegram → mobile-first student) and
avoids password-reset support burden for a low-friction, low-value-per-test
product.

Alternatives:
Email/password — kept as a schema option for future admin logins, but not
required for V1 student flow.

Consequences:
An `OtpProvider` abstraction is required so a mock provider can be swapped for
a real SMS gateway later without touching business logic.

---

## ADR-006: Mock Providers for OTP, Payment, and AI in Development

Date: 2026-09-12
Status: Accepted

Decision:
Define provider-agnostic interfaces (`OtpProvider`, `PaymentGateway`,
`AIService`) with a mock implementation selected via `OTP_PROVIDER=mock`,
`PAYMENT_PROVIDER=mock`, `AI_PROVIDER=mock` in development, so the entire
student/admin flow is testable locally without external accounts or network
calls to third parties.

Reason:
Required by the spec's Final Acceptance Criteria — the full flow (signup →
purchase → attempt → result) must work locally.

Alternatives:
Requiring real provider sandbox accounts for local dev — rejected as a
contributor-onboarding barrier.

Consequences:
No business logic may branch on which provider is active; only the
provider-selection wiring (a factory/config lookup) knows about `mock` vs a
real provider name.

---

## ADR-007: Question Versioning and Translation via Separate Tables

Date: 2026-09-12
Status: Accepted

Decision:
`questions` holds identity/metadata; `question_versions` holds versioned
content (marks, explanation); `question_translations` and
`question_option_translations` hold per-language text keyed off a specific
version. No per-language columns (`question_english`, `question_hindi`, ...).

Reason:
Required by spec section 44/13. Keeps language codes as data, supports adding a
new language without a migration, and lets attempts pin to an exact version so
edits to a question after an attempt started never retroactively change what
the student saw.

Alternatives:
Per-language columns — rejected, does not scale past the initial 3 languages
and violates the "language codes must remain configurable" requirement.

Consequences:
Every read path that renders a question must resolve
(question_version, language_code) rather than reading `questions` directly.

---

## ADR-008: Attempt Snapshotting

Date: 2026-09-12
Status: Accepted

Decision:
At attempt creation, `attempt_questions` rows freeze the exact
question_id + question_version_id + order + marks + negative_marks for that
attempt. Question-bank edits made after attempt start never alter an
in-progress or completed attempt.

Reason:
Required by spec section 27; fairness and auditability of already-taken exams
depend on this.

Consequences:
Question selection (manual or rule-based) must run inside the same transaction
that creates the `attempts` row.

---

## ADR-009: Backend-Authoritative Timer

Date: 2026-09-12
Status: Accepted

Decision:
`attempts.started_at` / `attempts.expires_at` are set server-side at attempt
creation. The frontend only displays a countdown computed from these values; the
backend re-validates time on every autosave and on submit, and auto-submits
expired attempts.

Reason:
Required by spec section 28; prevents client clock/timer manipulation from
extending exam time.

---

## ADR-010: Rule-Based Question Selection Runs at Attempt Creation

Date: 2026-09-12
Status: Accepted

Decision:
For tests using `selection_mode = RULE_BASED`, `test_rules` rows are evaluated
at the moment an attempt is created (inside the attempt-creation transaction),
producing the frozen `attempt_questions` snapshot. `test_questions` continues to
serve manually-curated tests.

Reason:
Keeps a single, transactional attempt-creation code path regardless of
selection mode, and guarantees the ADR-008 snapshot guarantee holds for
rule-based tests too.

---

## ADR-011: AI-Generated Questions Require Human Approval

Date: 2026-09-12
Status: Accepted

Decision:
`ai_generation_items` always start in a non-published review state. A
`question`/`question_version` row produced by AI cannot be attached to a
published test until an admin with `question.approve` sets its
`review_status`/`status` to approved.

Reason:
Required by spec section 18; prevents unreviewed, potentially incorrect AI
content from reaching students.

---

## ADR-012: Permission-Code Authorization (No Scattered Role Checks)

Date: 2026-09-12
Status: Accepted

Decision:
Authorization decisions are made against permission codes
(`question.approve`, `test.publish`, etc.) resolved via `role_permissions`, not
via inline `if (role === 'ADMIN')` checks. A centralized policy/middleware layer
resolves "does this user have permission X" for both API middleware and service
methods that need finer-grained checks (e.g. "own attempt only").

Reason:
Required by spec section 25; supports adding future roles
(QUESTION_MANAGER, EXAM_MANAGER, CONTENT_EDITOR, SUPPORT, FINANCE) without code
changes to every checked endpoint.

---

## ADR-013: UUID Primary Keys via pgcrypto

Date: 2026-09-12
Status: Accepted

Decision:
All tables use UUID primary keys generated by PostgreSQL's `pgcrypto` extension
(`gen_random_uuid()`), enabled in the first migration.

Reason:
Required by spec section 10/20. UUIDs avoid leaking sequential IDs (e.g. order
counts, question counts) and simplify merging data across environments.

---

## ADR-014: Storage — No File/Object Storage Decision Yet

Date: 2026-09-12
Status: Proposed (not yet needed in Phase 1)

Decision:
Deferred. V1 catalog/question data does not yet require binary asset storage
(question images, thumbnails) beyond a URL column. When IMAGE_BASED questions or
test-series thumbnails need real file uploads, record the chosen storage
approach (local disk vs S3-compatible object storage) here before implementing.

---

## ADR-015: Caching — No Caching Layer in V1

Date: 2026-09-12
Status: Accepted

Decision:
No Redis/cache layer in V1. All reads go directly to PostgreSQL.

Reason:
Premature at current scale; the spec's Final Acceptance Criteria does not
require it. Revisit only if a specific read path (e.g. public test catalog)
shows a measured need.

---

## ADR-016: Separate Git Repositories for Backend and Frontend

Date: 2026-09-13
Status: Accepted

Decision:
The backend (`gpc-portal-backend`) and frontend (`gpc-portal-frontend`) are
maintained as two separate git repositories rather than one monorepo. This
repo (`gpc-portal-backend`) additionally owns the full `docs/` folder and
`CLAUDE.md` for the entire platform, since the large majority of the
documentation (database schema, exam engine, security, commerce/payments, API
contracts) is backend/API-contract-driven. `gpc-portal-frontend` carries a
short README that links back here for full project context.

Reason:
Explicit project-owner preference for independent repos (e.g. independent
version history, access control, and deploy lifecycles per app). This is a
version-control/organization decision, not a reversal of ADR-001 (modular
monolith) — the backend remains a single deployable Express application
internally; only its source-control boundary relative to the frontend
changed.

Alternatives:
Monorepo with both apps as subdirectories (the original Phase 1 layout) —
simpler documentation cross-referencing (relative paths always resolved) but
rejected per project owner's explicit request. A third `gpc-portal-docs` repo
for shared documentation — rejected as an unnecessary third repository to
keep in sync for a two-app project.

Consequences:
- Any change to `gpc-portal-frontend` that affects the API contract, routes,
  or UX requirements documented in `gpc-portal-backend/docs/` (`API.md`,
  `FRONTEND.md`, `EXAM_ENGINE.md`) must have its corresponding doc update made
  in **this** repo, in the same logical unit of work, even though the code
  change lives in the other repo.
- There is no single commit/PR that atomically spans both a backend and
  frontend change; coordinated changes (e.g. a new endpoint + the UI that
  calls it) require sequencing (typically backend merged/deployed first) and
  should be cross-referenced in commit messages/PR descriptions.
- CI/CD, versioning, and release tagging are independent per repo.

---

## ADR-017: Migrations and Seeders Are Plain JavaScript (CommonJS), Not TypeScript

Date: 2026-09-13
Status: Accepted

Decision:
Files under `src/migrations/` and `src/seeders/` are plain `.js` (CommonJS),
using `require('sequelize')` and raw `queryInterface` calls — not the
project's TypeScript convention (ADR-003).

Reason:
`sequelize-cli` loads these files directly with `require()`; it does not run
them through our TypeScript build or `tsx`. Adding a TypeScript compilation
step (or a `ts-node`/`tsx` register hook) for one-off, throwaway migration
scripts would be meaningful tooling complexity for very little benefit — a
migration's `up`/`down` functions operate on raw `queryInterface`, not typed
Sequelize models, so there is little type safety to gain. This matches the
project owner's explicit "don't over-engineer the TypeScript setup"
instruction (see ADR-003). `eslint.config.js` and
`src/config/sequelize-cli.js` are the same kind of exception, for the same
reason (tooling that a non-TS-aware process loads directly).

Alternatives:
Wire `tsx`/`ts-node` into `sequelize-cli` via `NODE_OPTIONS`/a register hook
so migrations could be `.ts` — rejected as unnecessary complexity for
one-shot scripts that don't benefit much from static typing.

Consequences:
- All new migrations/seeders must be added as `.js` files following the
  existing pattern (see `src/utils/migrationHelpers.js` for shared column
  helpers — deliberately kept outside `src/migrations/` since `sequelize-cli`
  treats every file directly inside that folder as a migration).
- Sequelize **models** (used by application code) remain TypeScript, per
  ADR-003 — this exception is scoped narrowly to CLI-loaded tooling files.

---

## ADR-018: `product_items` Target Column Enforced by a Database CHECK Constraint

Date: 2026-09-13
Status: Accepted

Decision:
In addition to service-layer validation (required by spec section 17:
"Validate that the appropriate target is supplied for the selected access
type"), the `product_items` table has a Postgres `CHECK` constraint
(`product_items_target_matches_access_type`) enforcing that exactly the
column matching `access_type` is non-null (e.g. `access_type =
'INDIVIDUAL_TEST'` requires `test_id IS NOT NULL` and the other three target
columns `IS NULL`; `SUBSCRIPTION`/`ALL_ACCESS` require all four `IS NULL`).

Reason:
This invariant is fully expressible as a single-row CHECK constraint and is
exactly the kind of data-integrity rule the database should enforce
independently of application code — a bug in a future service-layer
validator (or a direct SQL fix/import) cannot silently create an
inconsistent `product_items` row. Verified against the real database: an
`INSERT` with a mismatched target is rejected with a clear constraint-name
error.

Alternatives:
Service-layer validation only — rejected as insufficient defense in depth for
data that commerce/entitlement logic depends on being correct.

Consequences:
Any new `access_type` value (beyond `INDIVIDUAL_TEST`, `TEST_SERIES`,
`EXAM_PACKAGE`, `SUBJECT_PACKAGE`, `SUBSCRIPTION`, `ALL_ACCESS`) requires a
migration to update this CHECK constraint, not just an application-level enum
change.

---

## ADR-019: Deferred Foreign Key for `questions.generation_job_id`

Date: 2026-09-13
Status: Accepted

Decision:
`questions.generation_job_id` is created as a plain nullable `UUID` column
(no FK) in its own migration (`create-questions`), and a separate later
migration (`add-fk-questions-generation-job`) adds the actual foreign-key
constraint to `ai_generation_jobs.id`, once that table exists.

Reason:
The spec's migration order (section 20) places `questions` (#16) before
`ai_generation_jobs` (#39) — `questions` cannot declare a FK to a table that
doesn't exist yet. Splitting the FK into a follow-up migration preserves the
given migration order exactly while still ending up with full referential
integrity once all 43 migrations have run. Verified: both migrations run
cleanly, and the full migration set was rolled back and reapplied end to end
without error.

Consequences:
Anyone reading `create-questions.js` in isolation will see
`generation_job_id` without a FK — the constraint only exists after
`add-fk-questions-generation-job.js` also runs. This is called out in a code
comment in `create-questions.js` and here.

---

## ADR-020: Opaque Bearer Session Tokens (SHA-256 Hashed), Not JWT

Date: 2026-09-13
Status: Accepted

Decision:
`POST /auth/verify-otp` issues a high-entropy random token (32 bytes,
hex-encoded) as the bearer credential, not a JWT. The raw token is returned
to the client once and never stored; the server stores only
`sha256(rawToken)` in `sessions.token_hash`. Every authenticated request
looks up the session by that hash and checks `revoked_at IS NULL AND
expires_at > now()`.

Reason:
`docs/AUTHENTICATION.md` (written in Phase 1) flagged this as a decision to
make and record before Phase 3. A signed JWT's main advantage — verifying a
request without a database round-trip — doesn't apply here: revocation
(logout, admin-forced logout) requires checking the `sessions` table on
every request regardless of token format, so a JWT would add signature
verification and expiry-claim bookkeeping for no real benefit while
duplicating state (the JWT's own `exp` vs. the `sessions.expires_at` row).
An opaque token is simpler, and its 256 bits of entropy make it exactly as
unguessable as a JWT's signature would make it unforgeable.

`jsonwebtoken` remains an installed dependency (unused by this decision) in
case a future need arises (e.g. short-lived tokens for a future third-party
API integration) — it is not wired into the login flow.

Alternatives:
Signed JWT containing `{ sub: userId, sid: sessionId }` — rejected per above;
would still require a DB hit per request to check revocation, so it doesn't
avoid the cost it's usually chosen to avoid.

Consequences:
- `src/utils/authTokens.ts` documents why OTPs are hashed with argon2 (slow,
  salted — appropriate for a tiny 6-digit keyspace checked only a few times)
  while session tokens are hashed with unsalted SHA-256 (fast — appropriate
  for a 256-bit random value checked on every request). Do not swap these:
  using argon2 for session tokens would make every authenticated request
  slow; using SHA-256 for OTPs would make the hash trivially reversible by
  brute-forcing all 1,000,000 possible codes.
- Every authenticated request costs one extra `sessions` SELECT (plus a
  `users` lookup) — acceptable at this project's scale; revisit only if
  profiling shows it matters (no premature caching layer per ADR-015).

---

## ADR-021: One `catalog.*` Permission Family for Categories, Exams, and Series

Date: 2026-09-13
Status: Accepted

Decision:
Admin CRUD for `exam_categories`, `competitive_exams`, and `test_series`
(Phase 4) is gated by four shared permission codes — `catalog.view`,
`catalog.create`, `catalog.update`, `catalog.delete` — rather than a
separate `category.*`/`exam.*`/`series.*` family per table (12 codes).

Reason:
Spec section 25 gives example permission codes per *feature area*
(`question.*`, `test.*`, `product.*`, ...), not per table — and doesn't
enumerate codes for categories/exams/series at all, leaving this an open
choice (flagged in `docs/DEVELOPMENT_STATUS.md`'s Phase 3 "Next Recommended
Task" as needing a decision). These three tables form one tightly nested
hierarchy (category → exam → series) that the master spec itself groups
under a single "EXAM CATALOG" section and a single phase ("Exam catalog").
In practice the same admin/content-manager role edits all three together;
splitting permissions per table would triple the permission count for no
observed access-control benefit yet.

Alternatives:
Per-table codes (`category.view`, `exam.view`, `series.view`, ...) —
rejected as premature; revisit if a real need emerges for a role that can
edit exams but not categories, for example.

Consequences:
- Seeded via `src/seeders/20260913100007-catalog-permissions.js` (run after
  the base `roles-and-permissions` seeder — permission codes can be added
  incrementally in their own seeder files without editing an
  already-applied one).
- If test/question-builder phases (5/6) later introduce their own
  `test.*`/`question.*`-scoped catalog-adjacent actions, keep `catalog.*`
  scoped specifically to categories/exams/series — don't let it grow into a
  catch-all.

---

## ADR-022: `subject.*` Permission Family Covers Subjects and Topics; Tags Have No Standalone Permission

Date: 2026-09-13
Status: Accepted

Decision:
`subject.view`/`create`/`update`/`delete` gate both `subjects` and `topics`
admin routes (topics are a subject-scoped nested resource, same reasoning as
ADR-021's `catalog.*`). `tags` have no admin CRUD routes or permission codes
at all — they're managed inline via `question.create`/`question.update`
(a question's payload includes a `tags: string[]` array; the service
find-or-creates each by name inside the question's own transaction).

Reason:
Same rationale as ADR-021: one nested hierarchy, one admin role, one
permission family. For tags specifically, spec section 24's admin API list
does not mention a standalone "tags" module at all — only
categories/exams/series/subjects/topics/questions/question
review/tests/.../settings — so inline management via the question payload
is the more faithful reading, not a shortcut.

Alternatives:
Separate `topic.*` codes — rejected, same reasoning as ADR-021.
Standalone `tag.*` CRUD endpoints — rejected as unrequested scope; revisit if
tags need to be created/browsed independently of authoring a question (e.g.
an admin tag-management screen), which would also need its own spec
clarification since none exists today.

Consequences:
- `docs/AUTHENTICATION.md`'s permission list groups `subject.*` right after
  `catalog.*` for the same "shared hierarchy" reason.
- A tag can currently only be created as a side effect of creating or
  editing a question that references it by name — there's no way to
  pre-create an empty tag or browse the tag list independent of questions.

---

## ADR-023: Editing Question Content Creates a New Version; Editing Metadata Does Not

Date: 2026-09-13
Status: Accepted

Decision:
Two distinct write paths exist for an existing question:
- `PUT /admin/questions/:id` — updates `questions` table metadata only
  (`subjectId`, `topicId`, `questionType`, `difficulty`, `tags`) in place.
  No new `question_versions` row, no audit log.
- `POST /admin/questions/:id/versions` — creates a **new**
  `question_versions` row (translations, options, marks) with
  `version_number` = current max + 1, and bumps `questions.version`. Writes
  an audit log (`question.version_created`) per spec section 46.

There is deliberately no "edit this question's text in place" endpoint.

Reason:
ADR-007 (question versioning) exists specifically so an attempt can pin to
an exact `question_version_id` and never have its content retroactively
change after a student has already seen it. If editing a question's text
mutated the existing `question_versions` row, that guarantee would be
silently broken the moment any question used in a past attempt was edited.
Metadata like which subject/topic a question is filed under, or its
difficulty tag, isn't part of what a student sees during an attempt
(`attempt_questions`/`test_questions` don't reference `subject_id`), so it's
safe to edit in place without versioning it.

Alternatives:
A single "update question" endpoint that always creates a new version, even
for a subject/topic re-file — rejected as needlessly bloating the version
history for changes that carry no content-integrity risk.

Consequences:
- Client code (admin UI, Phase 13) must know which kind of edit it's making
  and call the right endpoint — reclassifying a question's subject and
  fixing a typo in its question text are two different API calls.
- `GET /admin/questions/:id` always returns the question row plus its
  *latest* version (`questionRepository.findLatestVersion`, ordered by
  `version_number DESC`) — there is no endpoint yet to list or fetch a
  specific older version; add one if the admin UI needs a version history
  view.

---

## ADR-024: A Test's Structure Is Only Editable While `DRAFT`; Publish Auto-Computes Totals; Archive Reuses `test.close`

Date: 2026-09-13
Status: Accepted

Decision:
Three related rules for the test lifecycle (`src/services/testService.ts`):

1. `ensureTestEditable()` rejects (`TEST_NOT_EDITABLE`, 409) any create/
   update/delete on a test's basic info, sections, manual `test_questions`,
   or `test_rules` unless `status === 'DRAFT'`. `PUBLISHED`/`CLOSED`/
   `ARCHIVED` tests are structurally frozen — publish/close/archive are the
   only mutations left.
2. `publishTest()` runs `validateTest()` first (rejects with
   `TEST_VALIDATION_FAILED` and the specific error list if invalid), then
   **recomputes and overwrites** `tests.total_questions`/`total_marks` from
   the actual assembled content (sum of `test_questions.marks` for MANUAL,
   sum of `test_rules.question_count × default_marks_per_question` for
   RULE_BASED) rather than trusting whatever the admin entered at test
   creation.
3. `POST /admin/tests/:id/archive` is gated by the existing `test.close`
   permission — there is no separate `test.archive` code (spec's example
   list for `test.*` stops at `close`). Archive is also **not**
   audit-logged, unlike publish/close, since spec section 46 only lists
   "test publication, test closure."

Reason:
(1) No attempts exist yet (Phase 7), so there's no live data this protects
today — but a test's structure changing after `PUBLISHED` is exactly the
kind of moving-target bug ADR-008 (attempt snapshotting) exists to prevent
once attempts do exist, so the rule is put in place now rather than
retrofitted later under time pressure. (2) `total_questions`/`total_marks`
are read at attempt-creation time and shown to students before they start —
they must reflect what's actually assembled, not a number an admin typed in
before finishing the test. (3) Same "don't invent permission codes beyond
spec's examples" discipline as ADR-018/ADR-022; archiving a test an admin
already closed is a low-risk, rare action that doesn't need its own
permission tier.

Alternatives:
Allow editing a `PUBLISHED` test's non-structural fields (title,
description) — rejected for simplicity; revisit if this proves annoying in
practice (typo fixes currently require no path other than close → can't
reopen → would need a "revert to draft" action that doesn't exist).
A `test.archive` permission — rejected per ADR-018/ADR-022 precedent.

Consequences:
- Verified: adding a section to a `PUBLISHED` test returns `409
  TEST_NOT_EDITABLE`; publishing a test with an empty `test_questions`/
  `test_rules` set returns `422 TEST_VALIDATION_FAILED` with the specific
  reason; a `RULE_BASED` test's rule is checked against the real
  `PUBLISHED`+`APPROVED` question pool via `countApprovedQuestions()`
  (tag-filtered "any of" semantics) and rejected when the pool is too small.
- If a future phase needs to support editing a published test (e.g. fixing
  a typo without a full unpublish cycle), it should be a new, narrower
  endpoint — not a loosening of `ensureTestEditable()`, which several other
  services depend on for the DRAFT-only guarantee.

---

## ADR-025: Minimal Admin Entitlement Grant Ahead of Full Commerce

Date: 2026-09-13
Status: Accepted

Decision:
`POST /admin/entitlements` (`entitlement.grant` permission) lets an admin
manually grant a student access to a test, using the **real**
`products`/`product_items`/`entitlements` tables — not a parallel or
temporary mechanism. Given either `testId` or an existing `productItemId`:
- `testId` path: finds an existing `INDIVIDUAL_TEST` product_item for that
  test, or creates the minimal `Product` (`productType: INDIVIDUAL_TEST`)
  + `ProductItem` needed, reusing it for every future grant against the
  same test rather than creating a new product per grant.
- `productItemId` path: grants directly against an existing item (forward
  compatible with Phase 9's real product catalog).

Idempotent: granting to a user who already holds an active entitlement for
that product_item returns the existing row (200) rather than erroring or
duplicating. Every grant writes an `audit_logs` row
(`entitlement.grant` — spec section 46 lists "entitlement changes").
`orderId` stays null (no fake payment record is created); `grantedBy` +
`metadata.source = 'ADMIN_GRANT'` record who granted it and why.

Reason:
The master spec's own phase order puts Exam Engine (7) before Commerce (9)
and Payments (10) — meaning attempt creation's entitlement check has to
exist and be enforced *before* there's any self-service way to obtain an
entitlement. `docs/COMMERCE_AND_PAYMENTS.md` already documented "an admin
may grant an entitlement manually" as a planned feature (Admin Overrides),
so this isn't new scope invented for testing convenience — it's that
feature, built now because Phase 7 needs it to be end-to-end testable via
the real API (not just fixtures inside test files).

Alternatives:
Entitlement check only, with entitlement rows created solely via direct
Sequelize calls in tests — rejected per explicit project-owner direction;
would leave no way to manually test the purchase-adjacent flow via
curl/Postman until Phase 9 exists.
A duplicate/simplified grant table separate from `entitlements` — rejected;
the user explicitly required reusing the same commerce tables so Phase 9
extends this rather than replacing it.

Consequences:
- `src/repositories/productRepository.ts` is deliberately narrow (find/create
  only what the grant flow needs) — Phase 9 owns full product/pricing CRUD
  and should extend, not replace, this file.
- There is no revoke or list/browse endpoint yet (`GET /admin/entitlements`
  doesn't exist) — verify via direct DB query or Phase 9's tooling until
  built; see `docs/KNOWN_ISSUES.md`.
- The attempt engine's entitlement *check* (`findActiveEntitlementForTest`)
  never bypasses or shortcuts because of this endpoint's existence — it
  queries the same `entitlements` table a real purchase would populate.

---

## ADR-026: Entitlement-to-Test Resolution Priority (SUBJECT_PACKAGE Deferred)

Date: 2026-09-13
Status: Accepted

Decision:
`findActiveEntitlementForTest()` (`src/services/entitlementService.ts`)
resolves which `product_items` would grant access to a given test by
checking, in effect simultaneously: an exact `INDIVIDUAL_TEST` match, an
`EXAM_PACKAGE` matching the test's `competitive_exam_id`, a `TEST_SERIES`
match if the test belongs to one, or any blanket `SUBSCRIPTION`/
`ALL_ACCESS` item (no target columns, per the Phase 2 CHECK constraint).
**`SUBJECT_PACKAGE` is deliberately not resolved** — no active
subject-package entitlement will ever grant attempt access to a test today.

Reason:
A test is not scoped to a single subject (`tests` has no `subject_id`; its
questions can span many subjects via `test_questions`/`test_rules`), so
"does this test belong to that subject package" has no unambiguous answer
without a further, unspecified rule (e.g. "majority of questions",
"section-scoped subject match"). Spec doesn't define one. Guessing at a
rule here risks silently granting or denying access incorrectly — worse
than clearly not supporting it yet.

Alternatives:
Match if *any* question in the test belongs to the subject — rejected, far
too permissive (a single stray question would unlock the whole test).
Match if *all* questions belong to the subject — rejected, too fragile
(one off-topic question added later would silently revoke access for
existing SUBJECT_PACKAGE holders).

Consequences:
A `SUBJECT_PACKAGE` product/entitlement can be created (schema supports it)
but currently grants no actual test access — documented in
`docs/KNOWN_ISSUES.md`. Resolve this by specifying and implementing a
concrete subject-matching rule if/when SUBJECT_PACKAGE products are
actually needed.

---

## ADR-027: Rank and Percentile Deferred to Phase 8

Date: 2026-09-13
Status: Accepted

Decision:
`results.rank`/`results.percentile` are always `null` after Phase 7's
`submitAttempt()`. The `GET .../result` response includes them (as `null`)
only when the test's `show_rank`/`show_percentile` flags are set — the
fields exist and are wired through, but nothing computes a value yet.

Reason:
Rank/percentile are inherently cross-attempt: computing them requires
comparing one student's score against every other `EVALUATED` result for
the same test, which is a different kind of operation (a batch/aggregate
query, plausibly recomputed as more students finish, not a per-submission
side effect) than the rest of `submitAttempt()`, which only ever touches
one attempt's own rows. The master spec's own phase split names "Results"
as a separate phase (8) from "Exam engine" (7) — this is the natural
boundary: Phase 7 produces a correct, ungraded-on-a-curve score per
attempt; Phase 8 adds the cross-attempt aggregation and the admin
release/publish-results workflow implied by `results.released_at`.

Alternatives:
Compute rank/percentile inline during `submitAttempt()` by querying all
prior results for the test — rejected: ranks for already-submitted
students would go stale every time a new student submits, requiring a
recompute-everyone pass anyway, which belongs in its own service, not
bolted onto the submission transaction.

Consequences:
`GET .../result` for a test with `show_rank: true` currently always
returns `rank: null` — this is correct-but-incomplete, not a bug; Phase 8
should backfill/compute it without needing to touch `submitAttempt()`.

---

## ADR-028: Deeply Nested Sequelize Includes Must Use `separate: true`

Date: 2026-09-13
Status: Accepted

Decision:
Any Sequelize `include` chain 4 levels deep or more (e.g. attempt →
attempt_questions → question_version → options → translations) must mark
the `hasMany` associations partway down the chain with `separate: true`
(see `src/repositories/attemptRepository.ts`), rather than relying on a
single query with everything joined.

Reason:
**Found via manual testing, not a hypothetical**: a single joined query
this deep produces column aliases like
`"attemptQuestions.questionVersion.options.translations.questionOptionId"`
— longer than PostgreSQL's 63-byte identifier limit (`NAMEDATALEN`).
Postgres silently truncates the alias to
`"...options.translations.questionO"` rather than erroring, so Sequelize
maps the value back onto a mangled, wrong attribute name
(`questionO`/`languageC`/`optionTex` instead of
`questionOptionId`/`languageCode`/`optionText`) — the query succeeds, the
data is silently wrong. This surfaced as attempt-question options being
returned with no visible option text (the `text` field the serializer
tried to read simply didn't exist under its expected name).
`separate: true` runs that association as its own follow-up query instead,
keeping every alias short.

Alternatives:
Manually alias every column to something short — rejected, fragile and
easy to get wrong again on the next nested include added anywhere in the
chain. Flattening the data model to avoid deep nesting — not applicable;
the nesting reflects real, necessary relationships (a question's version
has options, options have per-language translations).

Consequences:
- Whenever a new deeply-nested `include` is added anywywhere in the
  codebase (attempts, results, or future features), check the resulting
  alias depth and add `separate: true` proactively rather than waiting to
  hit this failure mode again — it does not throw, it silently corrupts
  field names, which is far more dangerous than a query error.
- `separate: true` associations can't be filtered via a `where` on the
  *parent* query in the same call (they run as independent queries) — this
  hasn't been a limitation yet but will matter if a future query needs to
  filter attempt_questions by a nested option/translation property.

---

## ADR-029: Rank/Percentile Are Computed on `result.release`, Not Per-Submission, Using Standard Competition Ranking

Date: 2026-09-13
Status: Accepted

Decision:
`POST /admin/tests/:testId/results/release` (`result.release` permission)
is the only thing that computes `rank`/`percentile`
(`src/utils/rankings.ts`'s `computeRankings`, called from
`resultService.releaseResults`). It:
- Recomputes rank/percentile for **every** `EVALUATED` result of the test,
  every time it's called (safe to call repeatedly as more students finish).
- Uses **standard competition ranking** ("1224"): tied net scores
  (`scoredMarks − negativeMarks`) share a rank, and the next distinct score
  skips ahead by the number tied (two students tied for 1st → the next
  gets rank 3, not 2).
- Percentile = percentage of that test's evaluated attempts that scored
  *strictly lower* — tied entries share the same percentile. A test with
  exactly one evaluated result defines that result as the 100th percentile.
- Sets `releasedAt = now()` only for results that don't already have one —
  re-running never changes an already-released result's release timestamp,
  even though its rank/percentile may shift as more attempts are evaluated.

Reason:
ADR-027 (Phase 7) already decided rank/percentile don't belong in
`submitAttempt()` since they're a cross-attempt aggregate, not a
per-attempt computation, and deferred the "how" to Phase 8. Recomputing on
every release call (rather than trying to incrementally update as each
new attempt lands) is simple, always internally consistent (every
evaluated result at the time of the call gets a rank relative to the same
full set), and cheap enough at this project's scale (a sort + linear pass
over one test's results — verified correct with 3 students including a
2-way tie). Competition ranking (not "dense" or "ordinal" ranking) is the
convention most exam platforms and the general public expect from a
"rank."

Alternatives:
Dense ranking (ties share a rank, next rank is rank+1, no skip) —
rejected, less standard for competitive exam contexts, where a tie for
1st conventionally means "there is no 2nd place."
Incrementally updating ranks as each attempt submits — rejected per
ADR-027's original reasoning: it would mean every existing student's rank
changes (and needs re-persisting) every time anyone new finishes, which
doesn't actually save work over a full recompute and adds complexity for
no benefit.

Consequences:
- A test with `show_rank`/`show_percentile` enabled shows real values only
  after an admin has called the release endpoint at least once — before
  that, both are `null` (unchanged from ADR-027's default).
- Calling `release` again after new attempts finish is the supported way
  to refresh a "leaderboard" — there's no separate
  "recompute-without-releasing" action; releasing is cheap and idempotent
  enough on the release-timestamp side that this single action covers
  both needs.

---

## ADR-030: Admin Attempt/Result Views Are Separate Code Paths From Student-Facing Ones

Date: 2026-09-13
Status: Accepted

Decision:
`src/services/attemptAdminService.ts`'s `getAttemptDetailForAdmin`/
`listAttempts` and `resultService.ts`'s `getResultDetailForAdmin`/
`listResultsForTest` are **separate functions** from
`attemptService.getAttemptDetail`/`getResult` — not the same function
reused with an `isAdmin` flag. The admin versions return the full
eager-loaded data (including `is_correct`/`correct_option_id`), gated by
`attempt.view`/`result.view` (permission-code, admin-only); the student
versions stay exactly as strict as `docs/SECURITY.md` requires, gated by
`attemptPolicy.ensureOwnsAttempt` (data-scoped, self-only).

Reason:
Phase 7 shipped, then caught and fixed, a real bug where attempt-creation's
response accidentally used the wrong (unsanitized) code path and leaked
correctness data. The lesson recorded then (`docs/EXAM_ENGINE.md`,
`docs/SECURITY.md`) was "reuse the existing safe serializer, never
eager-load-and-return directly" — but that lesson only holds if the
*student* path is never asked to also serve the *admin* use case. A shared
function with an `if (isAdmin)` branch is exactly the kind of code that
silently regresses when someone adds a new field to the "admin-only"
branch and it accidentally leaks through a code path reachable by a
student. Two named, separately-tested functions make it structurally
obvious which one a new route should call.

Alternatives:
One `getAttemptDetail(attemptId, { includeCorrectness: boolean })` —
rejected: a boolean flag threaded through shared code is precisely the
shape of bug this decision exists to avoid; a caller only has to get the
flag wrong once.

Consequences:
- Any future admin-facing attempt/result endpoint must add to
  `attemptAdminService.ts`/`resultService.ts`'s admin functions, not
  extend the student-facing ones with new optional behavior.
- The two families deliberately don't share a serializer helper even where
  their output overlaps — some duplication is the accepted cost of keeping
  the security-critical path (student-facing) simple enough to audit at a
  glance.
