import { z } from 'zod';

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, alphanumeric, hyphen-separated')
  .optional();

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: slugField,
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});
export const updateSubjectSchema = createSubjectSchema.partial();

export const createTopicSchema = z.object({
  subjectId: z.string().uuid(),
  parentTopicId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(150),
  slug: slugField,
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});
export const updateTopicSchema = createTopicSchema.partial();
