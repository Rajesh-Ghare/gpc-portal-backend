import { z } from 'zod';

export const saveAnswerSchema = z.object({
  selectedOptionId: z.string().uuid().nullable().optional(),
  answerText: z.string().trim().optional(),
  numericAnswer: z.number().optional(),
  isMarkedForReview: z.boolean().optional(),
});
