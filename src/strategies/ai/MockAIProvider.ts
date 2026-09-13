import { randomUUID } from 'crypto';
import type {
  AIService,
  GenerateQuestionsParams,
  GeneratedQuestionCandidate,
  GeneratedTranslation,
  ValidationResult,
} from './AIService';

/**
 * Development/test-only provider. Never calls a real AI API — generates
 * deterministic, obviously-synthetic placeholder content so a reviewer (or
 * a test) can never mistake it for a real question. Every candidate is
 * MCQ_SINGLE with exactly one correct option, matching this project's V1
 * question-type scope (spec section 42).
 */
export class MockAIProvider implements AIService {
  async generateQuestions(params: GenerateQuestionsParams): Promise<GeneratedQuestionCandidate[]> {
    const candidates: GeneratedQuestionCandidate[] = [];
    for (let i = 0; i < params.count; i += 1) {
      const tag = randomUUID().slice(0, 8);
      candidates.push({
        questionType: params.questionType,
        difficulty: params.difficulty,
        defaultLanguageCode: params.languageCode,
        marks: 1,
        negativeMarks: 0,
        explanation: `Mock AI explanation for generated question ${tag}.`,
        translations: [
          {
            languageCode: params.languageCode,
            questionText: `[MOCK AI] Generated question ${i + 1} of ${params.count} (${tag})`,
          },
        ],
        options: [
          { optionKey: 'A', isCorrect: true, translations: [{ languageCode: params.languageCode, optionText: `Correct option (${tag})` }] },
          { optionKey: 'B', isCorrect: false, translations: [{ languageCode: params.languageCode, optionText: `Wrong option 1 (${tag})` }] },
          { optionKey: 'C', isCorrect: false, translations: [{ languageCode: params.languageCode, optionText: `Wrong option 2 (${tag})` }] },
          { optionKey: 'D', isCorrect: false, translations: [{ languageCode: params.languageCode, optionText: `Wrong option 3 (${tag})` }] },
        ],
      });
    }
    return candidates;
  }

  async translateQuestion(question: GeneratedQuestionCandidate, targetLanguageCode: string): Promise<GeneratedTranslation> {
    const source = question.translations[0];
    return {
      languageCode: targetLanguageCode,
      questionText: `[${targetLanguageCode}] ${source?.questionText ?? ''}`,
    };
  }

  async generateExplanation(question: GeneratedQuestionCandidate): Promise<string> {
    return `Mock explanation for: ${question.translations[0]?.questionText ?? 'untitled question'}`;
  }

  async validateQuestion(question: GeneratedQuestionCandidate): Promise<ValidationResult> {
    const issues: string[] = [];
    if (question.questionType === 'MCQ_SINGLE') {
      const correctCount = question.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        issues.push('MCQ_SINGLE questions must have exactly one correct option');
      }
    }
    return { valid: issues.length === 0, issues };
  }

  async classifyDifficulty(question: GeneratedQuestionCandidate): Promise<string> {
    return question.difficulty || 'MEDIUM';
  }
}

export const mockAIProvider = new MockAIProvider();
