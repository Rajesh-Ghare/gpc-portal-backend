import type { Evaluator, EvaluationInput, EvaluationResult } from './Evaluator';
import { McqSingleEvaluator } from './McqSingleEvaluator';

const mcqSingleEvaluator = new McqSingleEvaluator();

/**
 * V1 only truly evaluates MCQ_SINGLE (spec section 42). A question of any
 * other type manages to reach a test today (test_question assignment only
 * checks reviewStatus, not questionType — see docs/KNOWN_ISSUES.md), so
 * this falls back to treating it as UNANSWERED/0-marks rather than
 * crashing the whole submission transaction. Add a real evaluator here as
 * each type's grading logic is built.
 */
class UnsupportedTypeEvaluator implements Evaluator {
  async evaluate(_input: EvaluationInput): Promise<EvaluationResult> {
    return {
      answerStatus: 'UNANSWERED',
      marksAwarded: '0',
      negativeMarksAwarded: '0',
      finalMarks: '0',
      correctOptionId: null,
    };
  }
}
const unsupportedTypeEvaluator = new UnsupportedTypeEvaluator();

export function getEvaluator(questionType: string): Evaluator {
  switch (questionType) {
    case 'MCQ_SINGLE':
      return mcqSingleEvaluator;
    default:
      return unsupportedTypeEvaluator;
  }
}

export type { Evaluator, EvaluationInput, EvaluationResult } from './Evaluator';
