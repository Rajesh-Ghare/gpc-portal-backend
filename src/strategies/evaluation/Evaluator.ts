export interface EvaluationInput {
  questionVersionId: string;
  selectedOptionId: string | null;
  answerText: string | null;
  numericAnswer: string | null;
  marks: string;
  negativeMarks: string;
}

export interface EvaluationResult {
  answerStatus: 'CORRECT' | 'INCORRECT' | 'UNANSWERED';
  marksAwarded: string;
  negativeMarksAwarded: string;
  finalMarks: string;
  correctOptionId: string | null;
}

export interface Evaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
