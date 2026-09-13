import type { Test } from '../../models';
import { TestQuestion } from '../../models';
import type { QuestionSelectionStrategy, SelectedQuestion } from './QuestionSelectionStrategy';

export class ManualSelectionStrategy implements QuestionSelectionStrategy {
  async selectQuestions(test: Test): Promise<SelectedQuestion[]> {
    const testQuestions = await TestQuestion.findAll({
      where: { testId: test.id },
      order: [['displayOrder', 'ASC']],
    });

    return testQuestions.map((tq) => ({
      questionId: tq.questionId,
      questionVersionId: tq.questionVersionId,
      sectionId: tq.sectionId,
      marks: tq.marks ?? test.defaultMarksPerQuestion,
      negativeMarks: tq.negativeMarks ?? test.defaultNegativeMarks,
    }));
  }
}
