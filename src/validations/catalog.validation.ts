import { z } from 'zod';

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, alphanumeric, hyphen-separated')
  .optional();

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: slugField,
  description: z.string().trim().max(2000).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

export const createExamSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  slug: slugField,
  code: z.string().trim().max(50).optional(),
  description: z.string().trim().max(2000).optional(),
  conductingBody: z.string().trim().max(200).optional(),
  officialWebsite: z.string().trim().url().max(255).optional(),
  isActive: z.boolean().optional(),
});
export const updateExamSchema = createExamSchema.partial();

export const createSeriesSchema = z.object({
  competitiveExamId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(150),
  slug: slugField,
  description: z.string().trim().max(2000).optional(),
  thumbnailUrl: z.string().trim().url().max(500).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updateSeriesSchema = createSeriesSchema.partial();
