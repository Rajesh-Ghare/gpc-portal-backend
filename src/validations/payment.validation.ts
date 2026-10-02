import { z } from 'zod';

export const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * What a provider's browser checkout returns on success (for Razorpay:
 * razorpay_order_id / razorpay_payment_id / razorpay_signature). Kept
 * provider-neutral; the frontend maps the provider's field names.
 */
export const verifyPaymentSchema = z.object({
  providerOrderId: z.string().trim().min(1).max(100),
  providerPaymentId: z.string().trim().min(1).max(100),
  signature: z.string().trim().min(1).max(256),
});
