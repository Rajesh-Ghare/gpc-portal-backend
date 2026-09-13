import { z } from 'zod';

export const createAiJobSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid().optional(),
  competitiveExamId: z.string().uuid().optional(),
  questionType: z.string().trim().optional(),
  difficulty: z.string().trim().optional(),
  languageCode: z.string().trim().min(2).max(10).optional(),
  requestedCount: z.number().int().min(1).max(20),
});

export const rejectAiItemSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});
