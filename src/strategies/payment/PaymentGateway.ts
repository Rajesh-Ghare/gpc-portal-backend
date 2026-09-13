import type { Order } from '../../models';

export interface PaymentCreateResult {
  providerOrderId: string;
  providerPaymentId: string | null;
  raw: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  eventId: string;
  eventType: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  currencyCode: string;
  status: 'PAID' | 'FAILED';
}

/**
 * Provider-agnostic payment interface (docs/DECISIONS.md ADR-006) — services
 * depend only on this, never on a provider-specific shape. Only the concrete
 * gateway implementation and the factory in ./index.ts may know a provider's
 * name or wire format.
 */
export interface PaymentGateway {
  createPayment(order: Order): Promise<PaymentCreateResult>;

  /**
   * Verifies a raw inbound webhook body + signature and normalizes it.
   * `valid: false` means signature verification failed — callers must
   * reject the request without touching any payment/order/entitlement
   * state, regardless of what the body claims.
   */
  verifyWebhook(rawBody: unknown, signature: string | undefined): WebhookVerificationResult;
}
