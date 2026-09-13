# Development Status

## Current Phase

Phase 11 - AI (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [x] Question bank
- [x] Test builder
- [x] Exam engine
- [x] Results
- [x] Commerce
- [x] Payments
- [x] AI
- [ ] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

## Current Work

Phase 11 is complete and verified. Awaiting user confirmation before
starting Phase 12 (Student Frontend) — the backend's API surface is now
functionally complete for the full student journey (browse → purchase →
attempt → result) and the full admin authoring/review journey (catalog →
question bank incl. AI-assisted → test builder → publish → results →
commerce → payments), per `docs/API.md`.

## Completed (Phase 11, this session)

- **`AIService` interface** (`src/strategies/ai/AIService.ts`, ADR-006) —
  `generateQuestions`, `translateQuestion`, `generateExplanation`,
  `validateQuestion`, `classifyDifficulty`, matching `docs/AI.md`'s
  original contract exactly. `MockAIProvider` implements all five with
  deterministic, obviously-synthetic output; `src/strategies/ai/index.ts`'s
  `getAIService()` factory is the only place that knows the `mock` name
  (`AI_PROVIDER` env var) — same pattern as `OtpProvider`/`PaymentGateway`.
  **Only `generateQuestions` is wired to an endpoint this phase** — the
  other four complete the documented interface for a future phase to use.
- **`POST /admin/ai/jobs`** (`src/services/aiService.ts`): validates
  subject/topic, creates an `ai_generation_jobs` row, calls
  `AIService.generateQuestions()` **synchronously** (the mock provider has
  no real latency to hide behind a queue), creates one
  `ai_generation_items` row per candidate (status `PENDING_REVIEW`), flags
  `duplicateMatchQuestionId` via a simple exact-normalized-text match
  against already-APPROVED questions in the same subject, and marks the
  job `COMPLETED` — or `FAILED` with `errorCode AI_GENERATION_FAILED` (502)
  if the provider itself throws.
- **`GET /admin/ai/jobs?status=&subjectId=`, `GET /admin/ai/jobs/:jobId`**
  (job + items).
- **`POST /admin/ai/jobs/:jobId/items/:itemId/approve`**: creates a real
  question through the *exact same* `questionService.createQuestion()`
  transaction every manually-authored question uses (no parallel "AI
  question" path — ADR-033), then immediately calls
  `questionService.approveQuestion()` — the admin's approval of this item
  *is* the mandatory human review ADR-011 requires, so there's no separate
  second approval step. Stamps the new question with AI provenance
  (`sourceType='AI_GENERATED'`, `generatedByAi=true`, `aiProvider`,
  `aiModel`, `generationJobId`, `generationPromptVersion`, `generatedAt` —
  `questions` columns that existed since Phase 2 but went unused until
  now) via a new `aiMetadata` parameter on `createQuestion()` that is
  **not** part of the public `createQuestionSchema`, so no
  `POST /admin/questions` request can forge AI provenance (ADR-033).
  Audited as `question.approve` (reused, not a new `ai.*` audit action).
- **`POST /admin/ai/jobs/:jobId/items/:itemId/reject`** `{ reason? }`:
  marks the item `REJECTED`, records the reason, creates no question. Not
  separately audited (nothing was created/changed that spec section 46's
  audit list calls out).
- **Idempotency guard**: approving or rejecting an item not in
  `PENDING_REVIEW` returns `VALIDATION_ERROR` (409) rather than silently
  re-processing or double-counting `job.approvedCount`/`failedCount`.
- **New permission activated**: `ai.generate` (already seeded in Phase 1's
  baseline, unused until now — same "dormant code" pattern as
  `question.*`/`test.*`/`product.*` before it). Unlike every other admin
  module, one single permission gates the entire `/admin/ai/*` surface —
  no `.view`/`.approve` split, since the module's scope doesn't warrant the
  extra ceremony.
- **No new error codes or migrations needed** — `AI_JOB_NOT_FOUND`,
  `AI_GENERATION_FAILED`, and the `ai_generation_jobs`/`ai_generation_items`
  tables were all already seeded/defined since Phase 1/2 and unused until
  now.
- Added `NonAttribute` association declarations needed for the new nested
  includes: `AiGenerationJob.items`, `QuestionVersion.question`,
  `QuestionTranslation.questionVersion` (used by the duplicate-detection
  query, which joins translation → version → question).

### Testing

- **6 new integration tests** (`tests/integration/ai.test.ts`): student
  blocked from every AI route, job creation generating the requested item
  count, full approve flow (question created + published + AI-provenance
  fields asserted + job.approvedCount + audit log), reject flow (reason
  recorded, no question created, job.failedCount), re-approving an
  already-decided item rejected (409), and `findDuplicateQuestion` called
  directly (unit-style, mirroring how `computeRankings` was tested in
  Phase 8) asserting both a positive match (normalized case/whitespace-
  insensitive) and a negative one.
- Manually verified end-to-end against a live server/database first: job
  creation, approve (question published, AI metadata fields confirmed via
  `GET /admin/questions/:id`), reject, re-approve-rejected (409), and
  student `FORBIDDEN` from `/admin/ai/*` — same discipline as every prior
  phase.

## In Progress

Nothing — Phase 11 scope is complete.

## Blocked

None.

## Known Issues

Updated this phase (see `docs/KNOWN_ISSUES.md`): added "AI generation runs
synchronously, no job queue," "only generateQuestions is wired to an
endpoint," "duplicate detection is exact-text-match only, scoped to one
subject," and "no bulk approve/reject."

## Next Recommended Task

Phase 12: Student Frontend. The backend's full student-facing surface now
exists: auth (OTP), catalog/test browsing, product browsing, order
creation, payment (mock) + entitlement, attempt lifecycle (create/answer/
submit/result), all documented in `docs/API.md`. Build the React/Vite
frontend's student-facing screens against this real API — no backend
placeholder/mock data layer should be needed. Confirm `docs/FRONTEND.md`'s
Phase-1-era plan still matches the as-built API shapes before writing
components; update it where the two have diverged (e.g. exact response
envelopes, error codes actually returned).

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 11 (AI): an `AIService` interface (ADR-006)
with a `MockAIProvider`, a synchronous admin-triggered generation-job
workflow (`ai_generation_jobs`/`ai_generation_items`, tables that existed
since Phase 2 but were unused), and a review step where approving a
generated item routes through the exact same `questionService.
createQuestion()`/`approveQuestion()` path a manually-authored question
uses (ADR-033) — no parallel "AI question" table or endpoint family, and
AI provenance is passed through an internal-only parameter that no client
request can forge. A simple exact-text duplicate-detection check flags
likely-repeat generations without adding a new dependency. Verified
end-to-end manually (job → approve → published question with AI metadata
→ confirmed absent from any student-facing attempt payload) and via 6 new
integration tests (70 total, all passing).

## Important Files Changed

- `src/strategies/ai/{AIService.ts,MockAIProvider.ts,index.ts}` (created)
- `src/repositories/aiRepository.ts` (created)
- `src/services/aiService.ts` (created)
- `src/services/questionService.ts` (modified — `createQuestion()` gained
  an optional `aiMetadata` parameter, `AiSourceMetadata` interface)
- `src/validations/ai.validation.ts` (created)
- `src/controllers/aiController.ts` (created)
- `src/api/v1/routes/ai.routes.ts` (created)
- `src/app.ts` (modified — mounts `aiRouter`)
- `src/models/{AiGenerationJob.ts,QuestionVersion.ts,QuestionTranslation.ts}`
  (modified — `NonAttribute` association declarations)
- `tests/integration/ai.test.ts` (created)
- `docs/AI.md` (rewritten for the as-built workflow), `docs/API.md`,
  `docs/AUTHENTICATION.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`
  (ADR-033), `docs/KNOWN_ISSUES.md`, `docs/CHANGELOG.md`

## Database Changes

None — Phase 11 used the existing `ai_generation_jobs`/`ai_generation_items`
tables and the `questions` table's AI-provenance columns, all from Phase 2,
as-is. No new migrations, no new seeders (`ai.generate` was already seeded
in Phase 1's baseline).

## API Changes

Added (see `docs/API.md` for full request/response shapes):
- `GET /admin/ai/jobs`, `GET /admin/ai/jobs/:jobId`
- `POST /admin/ai/jobs`
- `POST /admin/ai/jobs/:jobId/items/:itemId/approve`
- `POST /admin/ai/jobs/:jobId/items/:itemId/reject`

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/unit/rankings.test.ts` — 5 tests (Phase 8).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (Phase 4).
- `tests/integration/questionBank.test.ts` — 7 tests (Phase 5).
- `tests/integration/testBuilder.test.ts` — 5 tests (Phase 6).
- `tests/integration/attempt.test.ts` — 5 tests (Phase 7).
- `tests/integration/results.test.ts` — 6 tests (Phase 8).
- `tests/integration/commerce.test.ts` — 14 tests (Phase 9).
- `tests/integration/payment.test.ts` — 10 tests (Phase 10).
- `tests/integration/ai.test.ts` — 6 tests (this phase).
- Total: 70 tests, all passing against the real test database.
- Still open: same items as Phase 9/10 (see `docs/KNOWN_ISSUES.md`), plus
  the new AI-specific gaps noted above.

## Handover Notes

- **Never add `sourceType`/`generatedByAi`/`aiProvider`/etc. as
  client-settable fields on `createQuestionSchema`.** They exist on
  `createQuestion()`'s internal `aiMetadata` parameter specifically so no
  request body can forge AI provenance — see ADR-033.
- **`aiService.approveItem()` is the only place that should ever call
  `questionService.createQuestion()` with `aiMetadata` set.** Any future
  AI-adjacent feature (e.g. bulk import) needing its own provenance should
  extend `AiSourceMetadata`'s shape, not bypass this rule.
- **AI generation is currently synchronous** — if a real (non-mock)
  `AIService` is ever wired up and its calls are slow, `createGenerationJob()`
  will need to change from awaiting the provider inline to a real background
  job using the `ai_generation_jobs.status = 'PROCESSING'` state that
  already exists but is currently only ever observed transiently.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
