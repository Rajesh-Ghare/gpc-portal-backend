import { z } from 'zod';

export const createOrderSchema = z.object({
  productId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(100),
});
