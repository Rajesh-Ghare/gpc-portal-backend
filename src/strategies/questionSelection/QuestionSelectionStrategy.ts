import type { Test } from '../../models';

export interface SelectedQuestion {
  questionId: string;
  questionVersionId: string;
  sectionId: string | null;
  marks: string;
  negativeMarks: string;
}

export interface QuestionSelectionStrategy {
  selectQuestions(test: Test): Promise<SelectedQuestion[]>;
}
