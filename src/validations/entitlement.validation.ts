import { z } from 'zod';

export const grantEntitlementSchema = z
  .object({
    userId: z.string().uuid(),
    testId: z.string().uuid().optional(),
    productItemId: z.string().uuid().optional(),
    attemptLimit: z.number().int().positive().optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Boolean(v.testId) !== Boolean(v.productItemId), {
    message: 'Provide exactly one of testId or productItemId',
  });
