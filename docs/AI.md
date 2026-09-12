# AI

## Abstraction

```ts
interface AIService {
  generateQuestions(params): Promise<GeneratedQuestion[]>;
  translateQuestion(question, targetLanguage): Promise<Translation>;
  generateExplanation(question): Promise<string>;
  validateQuestion(question): Promise<ValidationResult>;
  classifyDifficulty(question): Promise<Difficulty>;
}
```

Concrete providers (`MockAIProvider` in development; a real provider such as
the Claude API later) implement this interface. Business logic (job
orchestration, review workflow) depends only on `AIService`, never on a
provider SDK directly (ADR-006).

## Generation Job Workflow

```
ai_generation_jobs (requested_by, subject, topic, exam, question_type,
                     difficulty, language, requested_count, provider, model,
                     prompt_version, status, configuration)
  → AIService.generateQuestions() called per job
  → each candidate becomes an ai_generation_items row (raw_output,
    validation_errors, duplicate_match_question_id if a near-duplicate is
    detected)
  → job's generated_count / approved count / failed_count updated
```

## Human Review (Mandatory — ADR-011)

AI output never auto-publishes. An `ai_generation_items` row must be reviewed
by a user with `ai.generate`/`question.approve` permission before the
corresponding `questions`/`question_versions` row can be attached to a
published test. Rejections are recorded (`reviewed_by`, `reviewed_at`,
`status = REJECTED`) and do not create usable question content.

## Duplicate Detection

`duplicate_match_question_id` on `ai_generation_items` flags a likely duplicate
against existing approved questions; exact matching strategy (embedding
similarity, text hash, etc.) is an implementation detail to be decided and
recorded here (with an ADR if it introduces a new dependency such as a vector
store) when the AI module is actually built — not decided speculatively in
Phase 1.

## Provider Configuration

`AI_PROVIDER=mock` in development. See `.env.example`.
