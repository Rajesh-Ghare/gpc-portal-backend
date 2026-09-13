export interface GeneratedOptionTranslation {
  languageCode: string;
  optionText: string;
}

export interface GeneratedOption {
  optionKey: string;
  isCorrect?: boolean;
  numericValue?: number;
  translations: GeneratedOptionTranslation[];
}

export interface GeneratedTranslation {
  languageCode: string;
  questionText: string;
  explanation?: string;
  solutionSteps?: string;
}

/**
 * Shape of one generated candidate — deliberately matches
 * createQuestionSchema's version-content fields (minus subjectId/topicId,
 * which come from the job, not the AI) so an approved item can be handed
 * straight to questionService.createQuestion() without reshaping.
 */
export interface GeneratedQuestionCandidate {
  questionType: string;
  difficulty: string;
  defaultLanguageCode: string;
  marks?: number;
  negativeMarks?: number;
  explanation?: string;
  solutionSteps?: string;
  translations: GeneratedTranslation[];
  options: GeneratedOption[];
}

export interface GenerateQuestionsParams {
  subjectId: string;
  topicId?: string | null;
  competitiveExamId?: string | null;
  questionType: string;
  difficulty: string;
  languageCode: string;
  count: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Provider-agnostic AI interface (docs/DECISIONS.md ADR-006) — business
 * logic (src/services/aiService.ts) depends only on this, never on a
 * provider SDK directly. Only src/strategies/ai/index.ts's factory may know
 * a provider's name.
 *
 * Only `generateQuestions` is wired to an admin endpoint this phase (the
 * generation-job workflow docs/AI.md describes). The other four methods
 * complete the interface contract already documented in docs/AI.md for a
 * future phase to wire up (question translation, explanation backfill,
 * standalone validation/difficulty tooling) — see docs/KNOWN_ISSUES.md.
 */
export interface AIService {
  generateQuestions(params: GenerateQuestionsParams): Promise<GeneratedQuestionCandidate[]>;
  translateQuestion(question: GeneratedQuestionCandidate, targetLanguageCode: string): Promise<GeneratedTranslation>;
  generateExplanation(question: GeneratedQuestionCandidate): Promise<string>;
  validateQuestion(question: GeneratedQuestionCandidate): Promise<ValidationResult>;
  classifyDifficulty(question: GeneratedQuestionCandidate): Promise<string>;
}
