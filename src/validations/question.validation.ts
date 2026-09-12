import { z } from 'zod';

const optionTranslationSchema = z.object({
  languageCode: z.string().trim().min(2).max(10),
  optionText: z.string().trim().min(1),
});

const optionSchema = z.object({
  optionKey: z.string().trim().min(1).max(10),
  isCorrect: z.boolean().optional(),
  numericValue: z.number().optional(),
  translations: z.array(optionTranslationSchema).min(1),
});

const translationSchema = z.object({
  languageCode: z.string().trim().min(2).max(10),
  questionText: z.string().trim().min(1),
  explanation: z.string().trim().optional(),
  solutionSteps: z.string().trim().optional(),
});

const versionContentSchema = z.object({
  marks: z.number().optional(),
  negativeMarks: z.number().optional(),
  explanation: z.string().trim().optional(),
  solutionSteps: z.string().trim().optional(),
  translations: z.array(translationSchema).min(1),
  options: z.array(optionSchema).default([]),
});

export const createQuestionSchema = z
  .object({
    subjectId: z.string().uuid(),
    topicId: z.string().uuid().optional(),
    questionType: z.string().trim().optional(),
    difficulty: z.string().trim().optional(),
    defaultLanguageCode: z.string().trim().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
  })
  .merge(versionContentSchema);

export const createQuestionVersionSchema = versionContentSchema;

export const updateQuestionMetadataSchema = z.object({
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().nullable().optional(),
  questionType: z.string().trim().optional(),
  difficulty: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export const rejectQuestionSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});
