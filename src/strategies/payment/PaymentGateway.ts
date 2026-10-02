import type { IncomingHttpHeaders } from 'http';
import type { Order, Payment } from '../../models';

export interface PaymentCreateResult {
  providerOrderId: string;
  providerPaymentId: string | null;
  raw: Record<string, unknown>;
}

/** Everything a gateway may need to authenticate a webhook — some sign the raw bytes, some a parsed body. */
export interface WebhookRequest {
  rawBody: Buffer | undefined;
  body: unknown;
  headers: IncomingHttpHeaders;
}

export interface WebhookVerificationResult {
  valid: boolean;
  /**
   * False for an authentic event this platform doesn't act on (e.g.
   * Razorpay `order.paid` alongside `payment.captured`) — acknowledged with
   * a 2xx so the provider stops retrying, but nothing is recorded.
   */
  relevant: boolean;
  eventId: string;
  eventType: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  /** Major units (rupees), as stored on orders. */
  amount: number;
  currencyCode: string;
  status: 'PAID' | 'FAILED';
}

/** The three values a provider's browser checkout returns on success. */
export interface CheckoutConfirmationInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

/** A payment the gateway has confirmed server-to-server with the provider. */
export interface ConfirmedPayment {
  providerOrderId: string;
  providerPaymentId: string;
  /** Major units (rupees). */
  amount: number;
  currencyCode: string;
}

/**
 * Provider-agnostic payment interface (docs/DECISIONS.md ADR-006) — services
 * depend only on this, never on a provider-specific shape. Only the concrete
 * gateway implementation and the factory in ./index.ts may know a provider's
 * name or wire format.
 */
export interface PaymentGateway {
  /** Stored as `payments.provider`. */
  readonly name: string;

  createPayment(order: Order): Promise<PaymentCreateResult>;

  /**
   * Public data the browser needs to open this provider's checkout for a
   * payment, or null if there's no browser checkout (mock). Must never
   * include secrets.
   */
  checkoutOptions(payment: Payment): Record<string, unknown> | null;

  /**
   * Verifies an inbound webhook's signature and normalizes it.
   * `valid: false` means verification failed — callers must reject the
   * request without touching any payment/order/entitlement state,
   * regardless of what the body claims.
   */
  verifyWebhook(request: WebhookRequest): WebhookVerificationResult;

  /**
   * Confirms a browser checkout result (ADR-039): verifies its signature,
   * then fetches the payment from the provider server-to-server (capturing
   * it if only authorized) — never trusts the browser's claim alone. Throws
   * an AppError if the payment isn't genuinely captured for that order.
   * Absent for providers without a browser checkout.
   */
  confirmCheckout?(input: CheckoutConfirmationInput): Promise<ConfirmedPayment>;
}
