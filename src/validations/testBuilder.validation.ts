import { z } from 'zod';

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, alphanumeric, hyphen-separated')
  .optional();

export const createTestSchema = z.object({
  competitiveExamId: z.string().uuid(),
  testSeriesId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  slug: slugField,
  description: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  testType: z.string().trim().optional(),
  durationSeconds: z.number().int().positive(),
  passingMarks: z.number().optional(),
  defaultMarksPerQuestion: z.number().optional(),
  defaultNegativeMarks: z.number().optional(),
  selectionMode: z.enum(['MANUAL', 'RULE_BASED']).optional(),
  randomizeQuestions: z.boolean().optional(),
  randomizeOptions: z.boolean().optional(),
  attemptPolicy: z.string().trim().optional(),
  resultVisibility: z.string().trim().optional(),
  showScore: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
  showExplanations: z.boolean().optional(),
  showRank: z.boolean().optional(),
  showPercentile: z.boolean().optional(),
  availableFrom: z.coerce.date().optional(),
  availableUntil: z.coerce.date().optional(),
  requiredLanguages: z.array(z.string().trim()).optional(),
});
export const updateTestSchema = createTestSchema.partial();

export const createSectionSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().positive().optional(),
  marksPerQuestion: z.number().optional(),
  negativeMarks: z.number().optional(),
});
export const updateSectionSchema = createSectionSchema.partial();

export const addTestQuestionSchema = z.object({
  questionId: z.string().uuid(),
  questionVersionId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  displayOrder: z.number().int().min(1).optional(),
  marks: z.number().optional(),
  negativeMarks: z.number().optional(),
});

export const createRuleSchema = z.object({
  sectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  questionType: z.string().trim().optional(),
  difficulty: z.string().trim().optional(),
  languageCode: z.string().trim().optional(),
  questionCount: z.number().int().positive(),
  selectionStrategy: z.string().trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
  ruleConfig: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});
export const updateRuleSchema = createRuleSchema.partial();
