import { z } from 'zod';

const PRODUCT_TYPES = ['INDIVIDUAL_TEST', 'TEST_SERIES', 'SUBJECT_PACKAGE', 'EXAM_PACKAGE', 'SUBSCRIPTION', 'ALL_ACCESS'] as const;
const ACCESS_TYPES = PRODUCT_TYPES;

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(220).optional(),
  description: z.string().trim().max(5000).optional(),
  productType: z.enum(PRODUCT_TYPES),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createPriceSchema = z.object({
  currencyCode: z.string().trim().length(3).optional(),
  amount: z.number().positive(),
  originalAmount: z.number().positive().optional(),
  taxAmount: z.number().min(0).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const updatePriceSchema = createPriceSchema.partial();

export const createProductItemSchema = z
  .object({
    accessType: z.enum(ACCESS_TYPES),
    testId: z.string().uuid().optional(),
    testSeriesId: z.string().uuid().optional(),
    competitiveExamId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    attemptLimit: z.number().int().positive().optional(),
    accessDurationDays: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    const targets = {
      INDIVIDUAL_TEST: v.testId,
      TEST_SERIES: v.testSeriesId,
      EXAM_PACKAGE: v.competitiveExamId,
      SUBJECT_PACKAGE: v.subjectId,
    } as const;

    if (v.accessType === 'SUBSCRIPTION' || v.accessType === 'ALL_ACCESS') {
      if (v.testId || v.testSeriesId || v.competitiveExamId || v.subjectId) {
        ctx.addIssue({
          code: 'custom',
          message: `${v.accessType} must not set testId/testSeriesId/competitiveExamId/subjectId`,
        });
      }
      return;
    }

    const required = targets[v.accessType as keyof typeof targets];
    const allTargets = [v.testId, v.testSeriesId, v.competitiveExamId, v.subjectId];
    const setCount = allTargets.filter(Boolean).length;
    if (!required || setCount !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: `${v.accessType} requires exactly the matching target column to be set`,
      });
    }
  });
