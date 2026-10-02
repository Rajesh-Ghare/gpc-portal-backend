import { createHmac, timingSafeEqual } from 'crypto';
import type { IncomingHttpHeaders } from 'http';
import Razorpay from 'razorpay';
import type { Order, Payment } from '../../models';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/errorCodes';
import { fromMinorUnits, toMinorUnits } from '../../utils/money';
import type {
  CheckoutConfirmationInput,
  ConfirmedPayment,
  PaymentCreateResult,
  PaymentGateway,
  WebhookRequest,
  WebhookVerificationResult,
} from './PaymentGateway';

/** Razorpay rejects orders below ₹1 (100 paise). */
const MIN_AMOUNT_PAISE = 100;

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  /** Set in Razorpay Dashboard → Webhooks. Without it every webhook is rejected. */
  webhookSecret: string | null;
}

interface RazorpayPaymentEntity {
  id: string;
  order_id: string | null;
  amount: number | string;
  currency: string;
  status: string;
}

/** The slice of the Razorpay SDK this gateway uses — injectable so tests never call the real API. */
export interface RazorpayApi {
  orders: {
    create(params: {
      amount: number;
      currency: string;
      receipt: string;
      notes?: Record<string, string>;
    }): Promise<{ id: string } & Record<string, unknown>>;
  };
  payments: {
    fetch(paymentId: string): Promise<RazorpayPaymentEntity>;
    capture(paymentId: string, amount: number | string, currency: string): Promise<RazorpayPaymentEntity>;
  };
}

function hmacHex(secret: string, data: string | Buffer): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Constant-time comparison, so response timing can't leak how much of a forged signature matched. */
function signaturesMatch(expectedHex: string, received: string): boolean {
  const expected = Buffer.from(expectedHex, 'utf8');
  const actual = Buffer.from(received, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Maps any SDK/API failure to a 502 for the client — never a 401, which the
 * frontend treats as "your session expired" and logs the student out. The
 * real cause (e.g. wrong API keys) is logged server-side only.
 */
function providerError(action: string, err: unknown): AppError {
  const status = (err as { statusCode?: number | string })?.statusCode;
  const description = (err as { error?: { description?: string } })?.error?.description ?? (err as Error)?.message;
  if (Number(status) === 401) {
    console.error(`[razorpay] ${action}: authentication failed — check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.`);
  } else {
    console.error(`[razorpay] ${action} failed (${status ?? 'no status'}): ${description}`);
  }
  return new AppError(
    ErrorCode.PAYMENT_PROVIDER_ERROR,
    'The payment service is temporarily unavailable. Please try again in a moment.',
    502,
  );
}

/**
 * Razorpay Standard Checkout (ADR-039). Flow: createPayment() creates a
 * Razorpay order → the browser opens Checkout with its id → on success the
 * browser posts the payment id + signature to POST /payments/verify →
 * confirmCheckout() verifies the signature and re-checks the payment with
 * Razorpay. The `payment.captured`/`payment.failed` webhook is the backup
 * path for when the browser never makes it back (closed tab, lost network).
 */
export class RazorpayPaymentGateway implements PaymentGateway {
  readonly name = 'razorpay';

  constructor(
    private readonly config: RazorpayConfig,
    readonly api: RazorpayApi = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
    }) as unknown as RazorpayApi,
  ) {}

  async createPayment(order: Order): Promise<PaymentCreateResult> {
    const amount = toMinorUnits(order.totalAmount);
    if (amount < MIN_AMOUNT_PAISE) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Online payments must be at least ₹1.00.', 422);
    }

    try {
      const rzpOrder = await this.api.orders.create({
        amount,
        currency: order.currencyCode,
        receipt: order.orderNumber, // ≤ 40 chars; ORD-<ms>-<6 hex> is 24
        notes: { orderId: order.id },
      });
      return { providerOrderId: rzpOrder.id, providerPaymentId: null, raw: rzpOrder };
    } catch (err) {
      throw providerError('create order', err);
    }
  }

  checkoutOptions(payment: Payment): Record<string, unknown> {
    return {
      keyId: this.config.keyId, // public by design; the secret never leaves the server
      orderId: payment.providerOrderId,
      amount: toMinorUnits(payment.amount),
      currency: payment.currencyCode,
    };
  }

  async confirmCheckout(input: CheckoutConfirmationInput): Promise<ConfirmedPayment> {
    // 1. Signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret).
    const expected = hmacHex(this.config.keySecret, `${input.providerOrderId}|${input.providerPaymentId}`);
    if (!signaturesMatch(expected, input.signature)) {
      throw new AppError(ErrorCode.PAYMENT_VERIFICATION_FAILED, 'Payment signature verification failed', 400);
    }

    // 2. Ask Razorpay directly what happened to this payment.
    let payment: RazorpayPaymentEntity;
    try {
      payment = await this.api.payments.fetch(input.providerPaymentId);
    } catch (err) {
      throw providerError('fetch payment', err);
    }
    if (payment.order_id !== input.providerOrderId) {
      throw new AppError(ErrorCode.PAYMENT_VERIFICATION_FAILED, 'Payment does not belong to this order', 400);
    }

    // 3. Capture if the account isn't set to auto-capture — an authorized
    //    payment is never settled and Razorpay refunds it after a few days.
    if (payment.status === 'authorized') {
      try {
        payment = await this.api.payments.capture(payment.id, payment.amount, payment.currency);
      } catch (err) {
        // Auto-capture may have won the race; trust only a fresh read.
        payment = await this.api.payments.fetch(payment.id).catch(() => {
          throw providerError('capture payment', err);
        });
      }
    }

    if (payment.status !== 'captured') {
      throw new AppError(
        ErrorCode.PAYMENT_VERIFICATION_FAILED,
        `Payment was not completed (status: ${payment.status})`,
        400,
      );
    }

    return {
      providerOrderId: input.providerOrderId,
      providerPaymentId: payment.id,
      amount: fromMinorUnits(payment.amount),
      currencyCode: payment.currency,
    };
  }

  verifyWebhook(request: WebhookRequest): WebhookVerificationResult {
    const invalid: WebhookVerificationResult = {
      valid: false,
      relevant: false,
      eventId: '',
      eventType: '',
      providerOrderId: '',
      providerPaymentId: null,
      amount: 0,
      currencyCode: '',
      status: 'FAILED',
    };

    // Razorpay signs the exact raw bytes — re-serialized JSON may differ.
    const signature = header(request.headers, 'x-razorpay-signature');
    if (!this.config.webhookSecret || !signature || !request.rawBody) return invalid;
    if (!signaturesMatch(hmacHex(this.config.webhookSecret, request.rawBody), signature)) return invalid;

    let body: {
      event?: string;
      payload?: { payment?: { entity?: RazorpayPaymentEntity } };
    };
    try {
      body = JSON.parse(request.rawBody.toString('utf8'));
    } catch {
      return invalid;
    }

    const eventType = body.event ?? '';
    const entity = body.payload?.payment?.entity;
    const eventId = header(request.headers, 'x-razorpay-event-id') ?? `${eventType}:${entity?.id ?? 'unknown'}`;

    if ((eventType !== 'payment.captured' && eventType !== 'payment.failed') || !entity?.order_id) {
      return { ...invalid, valid: true, relevant: false, eventId, eventType };
    }

    return {
      valid: true,
      relevant: true,
      eventId,
      eventType,
      providerOrderId: entity.order_id,
      providerPaymentId: entity.id,
      amount: fromMinorUnits(entity.amount),
      currencyCode: entity.currency,
      status: eventType === 'payment.captured' ? 'PAID' : 'FAILED',
    };
  }
}
