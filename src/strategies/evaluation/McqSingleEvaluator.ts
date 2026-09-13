import { QuestionOption } from '../../models';
import type { EvaluationInput, EvaluationResult, Evaluator } from './Evaluator';

export class McqSingleEvaluator implements Evaluator {
  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const correctOption = await QuestionOption.findOne({
      where: { questionVersionId: input.questionVersionId, isCorrect: true },
    });
    const correctOptionId = correctOption?.id ?? null;

    if (!input.selectedOptionId) {
      return {
        answerStatus: 'UNANSWERED',
        marksAwarded: '0',
        negativeMarksAwarded: '0',
        finalMarks: '0',
        correctOptionId,
      };
    }

    if (input.selectedOptionId === correctOptionId) {
      return {
        answerStatus: 'CORRECT',
        marksAwarded: input.marks,
        negativeMarksAwarded: '0',
        finalMarks: input.marks,
        correctOptionId,
      };
    }

    return {
      answerStatus: 'INCORRECT',
      marksAwarded: '0',
      negativeMarksAwarded: input.negativeMarks,
      finalMarks: String(-Number(input.negativeMarks)),
      correctOptionId,
    };
  }
}
