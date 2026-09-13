import { createHmac, randomUUID } from 'crypto';
import type { Order } from '../../models';
import type { PaymentCreateResult, PaymentGateway, WebhookVerificationResult } from './PaymentGateway';

export interface MockWebhookPayload {
  eventId: string;
  eventType: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  currencyCode: string;
  status: 'PAID' | 'FAILED';
}

/**
 * Development/test-only gateway. Never calls a real payment provider.
 * Signs/verifies mock webhook payloads with an HMAC so the webhook
 * verification code path is exercised for real (not bypassed) even though
 * no external provider actually calls back — see
 * docs/COMMERCE_AND_PAYMENTS.md's Payment Flow section.
 */
export class MockPaymentGateway implements PaymentGateway {
  private readonly secret = 'mock-payment-webhook-secret';

  async createPayment(order: Order): Promise<PaymentCreateResult> {
    return {
      providerOrderId: `mock_order_${order.id}`,
      providerPaymentId: null,
      raw: { mock: true },
    };
  }

  /** Test/dev-only: builds and signs a payload as if the mock provider were calling the webhook. */
  buildSignedWebhook(payload: Omit<MockWebhookPayload, 'eventId'>): { body: MockWebhookPayload; signature: string } {
    const body: MockWebhookPayload = { eventId: randomUUID(), ...payload };
    return { body, signature: this.sign(body) };
  }

  private sign(body: MockWebhookPayload): string {
    return createHmac('sha256', this.secret).update(JSON.stringify(body)).digest('hex');
  }

  verifyWebhook(rawBody: unknown, signature: string | undefined): WebhookVerificationResult {
    const invalid: WebhookVerificationResult = {
      valid: false,
      eventId: '',
      eventType: '',
      providerOrderId: '',
      providerPaymentId: null,
      amount: 0,
      currencyCode: '',
      status: 'FAILED',
    };

    if (!signature || typeof rawBody !== 'object' || rawBody === null) {
      return invalid;
    }

    const body = rawBody as MockWebhookPayload;
    if (this.sign(body) !== signature) {
      return invalid;
    }

    return {
      valid: true,
      eventId: body.eventId,
      eventType: body.eventType,
      providerOrderId: body.providerOrderId,
      providerPaymentId: body.providerPaymentId ?? null,
      amount: Number(body.amount),
      currencyCode: body.currencyCode,
      status: body.status,
    };
  }
}

export const mockPaymentGateway = new MockPaymentGateway();
