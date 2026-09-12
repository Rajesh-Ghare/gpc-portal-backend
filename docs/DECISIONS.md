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
