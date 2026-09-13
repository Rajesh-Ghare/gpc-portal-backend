# AI

## Abstraction — Implemented (Phase 11)

```ts
interface AIService {
  generateQuestions(params): Promise<GeneratedQuestionCandidate[]>;
  translateQuestion(question, targetLanguage): Promise<Translation>;
  generateExplanation(question): Promise<string>;
  validateQuestion(question): Promise<ValidationResult>;
  classifyDifficulty(question): Promise<Difficulty>;
}
```

`src/strategies/ai/AIService.ts` defines this exactly. `MockAIProvider`
(`src/strategies/ai/MockAIProvider.ts`) implements all five methods —
deterministic, obviously-synthetic output, never a real network call.
`src/strategies/ai/index.ts`'s `getAIService()` factory is the only place
that knows the `mock` provider name (selected via `AI_PROVIDER`); business
logic (`src/services/aiService.ts`) depends only on the interface (ADR-006).

**Only `generateQuestions` is wired to an endpoint this phase.** The other
four methods complete the documented interface contract for a future phase
to use (standalone question translation, explanation backfill, admin
validation/difficulty tooling) — see `docs/KNOWN_ISSUES.md`.

## Generation Job Workflow — Implemented (Phase 11)

```
POST /admin/ai/jobs { subjectId, topicId?, competitiveExamId?,
                       questionType?, difficulty?, languageCode?,
                       requestedCount (1-20) }
  → ai_generation_jobs row created (status=PROCESSING, started_at=now())
  → AIService.generateQuestions() called once, synchronously
  → each candidate becomes an ai_generation_items row
    (status=PENDING_REVIEW, raw_output=the candidate JSON,
     duplicate_match_question_id set if an exact-normalized-text match
     against an already-APPROVED question in the same subject is found)
  → job's generated_count set to the actual candidate count; status=COMPLETED
  → on a provider error: job status=FAILED, error_message set,
    errorCode AI_GENERATION_FAILED (502) returned to the caller instead
```

Processing runs **synchronously within the request** rather than through a
queue — the mock provider has no real latency to hide behind one, and
`aiService.createGenerationJob()` is written so a real (slower, genuinely
async) provider could be swapped in later without changing the job/item
table shape or the review endpoints, only how/when the job transitions out
of `PROCESSING`.

`GET /admin/ai/jobs?status=&subjectId=`, `GET /admin/ai/jobs/:jobId` (job +
its items) — all gated by `ai.generate` (the only permission this module
uses; there's no separate `ai.view`).

## Human Review (Mandatory — ADR-011) — Implemented (Phase 11)

AI output never auto-publishes. Reviewing an `ai_generation_items` row *is*
the mandatory human review:

```
POST /admin/ai/jobs/:jobId/items/:itemId/approve
  → requires item.status === PENDING_REVIEW (409 otherwise)
  → questionService.createQuestion() — the EXACT SAME transactional
    creation path every manually-authored question goes through, never a
    parallel "AI question" table or code path — creates the real
    questions/question_versions/question_translations/question_options rows,
    stamped with AI provenance (see below)
  → questionService.approveQuestion() immediately marks it
    reviewStatus=APPROVED, status=PUBLISHED (the admin approving this item
    already performed the human review the ADR requires — there is no
    second, separate "now also approve the question" step)
  → item.status=APPROVED, item.question_id set, reviewed_by/reviewed_at set
  → job.approved_count incremented
  → audited as question.approve (the same audit action a manually-authored
    question's approval writes — see docs/SECURITY.md)

POST /admin/ai/jobs/:jobId/items/:itemId/reject { reason? }
  → requires item.status === PENDING_REVIEW (409 otherwise)
  → item.status=REJECTED, reviewed_by/reviewed_at set, reason recorded in
    validation_errors — no question is ever created
  → job.failed_count incremented
  → not separately audit-logged (spec section 46's list doesn't call out
    "AI item rejected"; nothing was created or changed that needs a trail)
```

**AI provenance on the created question**: `questionService.createQuestion()`
takes an optional third `aiMetadata` parameter
(`{ generationJobId, provider, model, promptVersion }`) — deliberately
**not** part of `createQuestionSchema` (the public request-body contract),
so no admin-authored `POST /admin/questions` request can forge AI
provenance. Only `aiService.approveItem()` passes it, after review has
actually happened. This sets `questions.source_type = 'AI_GENERATED'`,
`generated_by_ai = true`, `ai_provider`, `ai_model`, `generation_job_id`,
`generation_prompt_version`, and `generated_at` — columns that existed on
the `questions` table since Phase 2 but went unused until this phase.

**Never exposed to a student during an attempt**: `generated_by_ai`/
`ai_provider`/`ai_model`/`generation_prompt_version` are plain `Question`
columns, never touched by `attemptRepository.ts`/`attemptService.ts`'s
serializers (which only ever read through `QuestionVersion`/translations/
options) — see `docs/SECURITY.md`.

## Duplicate Detection — Implemented (Phase 11, intentionally simple)

`aiService.findDuplicateQuestion(subjectId, candidate)`: an exact,
normalized (trimmed + lowercased) text match of the candidate's primary
translation against `question_translations` belonging to an
already-**APPROVED** question in the same subject. Flags
`ai_generation_items.duplicate_match_question_id` at job-creation time; a
flagged item can still be approved or rejected — the reviewer decides, this
is informational only, not a hard block.

This is deliberately the simplest thing that could catch the common "the
mock/AI regenerated near-identical content" case, per docs/AI.md's original
plan to defer a real similarity strategy (embeddings, fuzzy matching, a
vector store) until it's actually needed — introducing a new dependency for
this would be scope creep beyond what Phase 11 requires. See
`docs/KNOWN_ISSUES.md` for what a future real provider integration should
reconsider here.

## Provider Configuration

`AI_PROVIDER=mock` in development. See `.env.example`. No real (non-mock)
`AIService` implementation exists yet — add one behind the same interface
when a real provider (e.g. the Claude API) is chosen.
