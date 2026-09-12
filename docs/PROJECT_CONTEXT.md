# Project Context

## What This Platform Does

This is a generic, configuration-driven competitive-exam practice platform. Students
discover tests (initially via a Telegram channel acting purely as a promotional
distribution channel), log in with mobile OTP, pay a small fee for a test/product,
and take a timed online exam. The backend evaluates answers and produces a result.

The platform is explicitly **not** hardcoded for any single exam. The same schema and
code must support SSC, SSC CGL, Banking, IBPS PO, MPSC, UPSC, Railway, Police,
Teaching, Engineering, and future exams without code changes — differences between
exams are represented as rows in the database (categories, exams, subjects, topics,
tests, rules), never as `if (exam === 'SSC')`-style branches.

## Target Users

- **Students**: mobile-first users arriving from a promotional link, taking a single
  test or a series of tests for a specific competitive exam.
- **Admins / Content team**: create exam categories, exams, test series, subjects,
  topics, questions, and tests; review AI-generated questions; manage pricing and
  publishing.
- **Super Admins**: full platform control, role/permission management.

## Student Flow

```
Telegram promo link → Exam portal → Mobile OTP login → View test details
  → Purchase (mock payment in dev) → Entitlement granted → Start attempt
  → Answer questions (autosaved) → Timer enforced by backend → Submit
  → Backend evaluates → Result displayed
```

## Admin Flow

```
Login → Create category → Create competitive exam → Create subject/topic
  → Create questions → Approve questions → Create test → Configure test
  → Select questions (manual or rule-based) → Validate → Create product
  → Set price → Publish test
```

## Payment Flow

Order created → payment initiated against a `PaymentGateway` abstraction (mock
provider in development) → provider webhook received → signature verified →
event idempotency checked → amount/currency verified against the order →
payment + order updated → entitlement granted. The frontend is never trusted for
payment status; only a verified webhook (or, for the mock provider, its
equivalent server-side confirmation) creates an entitlement.

## Question-Bank Flow

Questions are versioned (`questions` → `question_versions`) and translated
(`question_translations`, `question_option_translations`) rather than having one
column per language. Options are a variable-length list per question version, not
assumed to be exactly four. AI-generated questions land in `ai_generation_items`
and require human review before they can be attached to a test — AI output is
never auto-published.

## AI Flow

An `AIService` abstraction (provider-agnostic) can generate questions, translate
them, generate explanations, validate them, and classify difficulty. Every AI job
is tracked in `ai_generation_jobs`/`ai_generation_items` with full audit trail.
Approval is always a manual, human, permissioned action.

## Current V1 Scope

- Modular monolith: Node.js/Express/TypeScript backend, React/Vite/TypeScript
  frontend, PostgreSQL via Sequelize.
- Mobile OTP authentication (mock OTP provider for local development).
- Exam catalog: categories → competitive exams → test series → tests → sections.
- Question bank with versioning, translations, and tags; MCQ_SINGLE as the primary
  question type, with the architecture supporting more types later.
- Manual and rule-based test question selection.
- Attempt engine with server-authoritative timing and answer autosave.
- Result calculation with configurable negative marking.
- Commerce: products, prices, orders, payments (mock provider), entitlements.
- AI question generation abstraction with mandatory human review.
- Full audit logging for administrative actions.

## Future Scope (Not Built in V1, Architecture Must Not Block It)

- Additional question types: MCQ_MULTI, TRUE_FALSE, NUMERIC, SHORT_TEXT,
  LONG_TEXT/ESSAY, and eventually MATCHING, ORDERING, ASSERTION_REASON,
  PASSAGE_BASED, IMAGE_BASED.
- Written/descriptive exam evaluation workflows.
- Additional roles: QUESTION_MANAGER, EXAM_MANAGER, CONTENT_EDITOR, SUPPORT,
  FINANCE.
- Additional languages beyond the initial `en`/`hi`/`mr` set (language codes are
  data, not enum constants baked into logic).
- Real payment providers (Razorpay/Stripe/etc.) behind the same `PaymentGateway`
  interface used by the mock provider.
- Real OTP/SMS providers behind the same interface used by the mock provider.

## Important Terminology

- **Attempt**: one student's timed run through a test. Once started, its question
  set, versions, order, and marks are frozen (a "snapshot") even if the underlying
  question bank changes later.
- **Entitlement**: the record that proves a user is allowed to attempt a given
  test/series/subject/exam, created only after a verified payment (or an admin
  grant).
- **Product / Product Item**: a purchasable unit (`INDIVIDUAL_TEST`,
  `TEST_SERIES`, `SUBJECT_PACKAGE`, `EXAM_PACKAGE`, `SUBSCRIPTION`, `ALL_ACCESS`);
  a product item points at the concrete target (test/series/exam/subject) that
  purchasing the product unlocks.
- **Question version**: an immutable snapshot of a question's content at a point
  in time; translations and options hang off a specific version, and attempts
  reference a specific version so historical attempts remain accurate.
- **Test rule**: a declarative row describing how many questions of a given
  subject/topic/type/difficulty/tag to pull into a test at attempt-start time,
  used for rule-based (as opposed to manually curated) tests.
