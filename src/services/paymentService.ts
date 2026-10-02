import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { sequelize, type Payment } from '../models';
import * as paymentRepo from '../repositories/paymentRepository';
import * as orderRepo from '../repositories/orderRepository';
import { getOrderOrThrow } from './orderService';
import { ensureOwnsOrder } from '../policies/orderPolicy';
import { createEntitlementsForPaidOrder } from './entitlementService';
import { getPaymentGateway } from '../strategies/payment';
import { mockPaymentGateway } from '../strategies/payment/MockPaymentGateway';
import type { PaymentGateway, WebhookRequest } from '../strategies/payment/PaymentGateway';
import { env } from '../config/env';
import { toMinorUnits } from '../utils/money';
import type { createPaymentSchema, verifyPaymentSchema } from '../validations/payment.validation';

type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

/** The payment row plus whatever the browser needs to open the provider's checkout (null for mock). */
function withCheckout(payment: Payment, gateway: PaymentGateway) {
  return { ...payment.toJSON(), checkout: gateway.checkoutOptions(payment) };
}

/**
 * Creates a PENDING payment for an order via the configured gateway.
 * Idempotent on repeated calls for the same order while one payment is
 * still PENDING with the *current* provider — returns the existing attempt
 * rather than creating a second provider-side order. (A pending payment
 * left over from a different provider, e.g. after switching mock →
 * razorpay, can't be paid through this one, so a new one is created.)
 */
export async function createPayment(input: CreatePaymentInput, userId: string) {
  const order = await getOrderOrThrow(input.orderId);
  ensureOwnsOrder(order, userId);

  if (order.status === 'PAID') {
    throw new AppError(ErrorCode.ORDER_ALREADY_PAID, 'This order has already been paid', 409);
  }

  const gateway = getPaymentGateway();

  const existingPending = await paymentRepo.findPendingPaymentByOrderId(order.id);
  if (existingPending && existingPending.provider === gateway.name) {
    return withCheckout(existingPending, gateway);
  }

  const result = await gateway.createPayment(order);

  const payment = await paymentRepo.createPayment({
    orderId: order.id,
    provider: gateway.name,
    providerPaymentId: result.providerPaymentId,
    providerOrderId: result.providerOrderId,
    status: 'PENDING',
    amount: order.totalAmount,
    currencyCode: order.currencyCode,
    rawResponse: result.raw,
  });
  return withCheckout(payment, gateway);
}

/** A payment outcome already authenticated with the provider — by webhook signature or by checkout confirmation. */
interface VerifiedPaymentEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  currencyCode: string;
  status: 'PAID' | 'FAILED';
}

/**
 * The only place an order transitions to PAID and entitlements get created
 * from a purchase. Callers must have authenticated the event with the
 * provider first (processWebhook / verifyCheckoutPayment) — never a
 * client-trusted "payment succeeded" claim (see docs/SECURITY.md).
 *
 * Everything runs in **one transaction** (ADR-036): claim the event id
 * (idempotency via payment_webhook_events' unique index), lock the payment
 * and order rows, re-verify amount/currency against the order's own stored
 * total, update payment/order, and create entitlements. Any failure rolls
 * back everything — including the event claim — so a retry reprocesses it
 * rather than being skipped as a duplicate.
 */
async function applyVerifiedPaymentEvent(event: VerifiedPaymentEvent) {
  return sequelize.transaction(async (transaction) => {
    const eventRowId = await paymentRepo.claimWebhookEvent(
      {
        provider: env.paymentProvider,
        providerEventId: event.eventId,
        eventType: event.eventType,
        payload: event.payload,
      },
      transaction,
    );
    if (!eventRowId) {
      return { alreadyProcessed: true as const };
    }

    // Lock order: payment, then order — the only code path that locks both,
    // so concurrent events (for the same or different payments of one
    // order) serialize without deadlocking.
    const payment = await paymentRepo.findPaymentByProviderOrderIdForUpdate(event.providerOrderId, transaction);
    if (!payment) {
      throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found for this provider order', 404);
    }

    const order = await orderRepo.findOrderByIdForUpdate(payment.orderId, transaction);
    if (!order) {
      throw new AppError(ErrorCode.ORDER_NOT_FOUND, 'Order not found for this payment', 404);
    }

    if (toMinorUnits(order.totalAmount) !== toMinorUnits(event.amount) || order.currencyCode !== event.currencyCode) {
      throw new AppError(ErrorCode.PAYMENT_VERIFICATION_FAILED, 'Payment amount/currency does not match the order', 422);
    }

    const providerPaymentId = event.providerPaymentId ?? payment.providerPaymentId;

    if (event.status === 'FAILED') {
      // Providers can deliver events out of order; a failure arriving after
      // a capture must never un-pay a payment (or its granted access).
      if (payment.status === 'PAID') {
        await paymentRepo.markWebhookEventProcessed(eventRowId, 'IGNORED', transaction);
        return { alreadyProcessed: false as const, status: 'IGNORED' as const };
      }
      await paymentRepo.updatePayment(payment, { status: 'FAILED', failedAt: new Date(), providerPaymentId }, transaction);
      await paymentRepo.markWebhookEventProcessed(eventRowId, 'PROCESSED', transaction);
      return { alreadyProcessed: false as const, status: 'FAILED' as const };
    }

    const now = new Date();
    if (payment.status !== 'PAID') {
      await paymentRepo.updatePayment(payment, { status: 'PAID', paidAt: now, providerPaymentId }, transaction);
    }
    if (order.status !== 'PAID') {
      await order.update({ status: 'PAID', paidAt: now }, { transaction });
    }

    const entitlements = await createEntitlementsForPaidOrder(order, transaction);
    await paymentRepo.markWebhookEventProcessed(eventRowId, 'PROCESSED', transaction);

    return { alreadyProcessed: false as const, status: 'PAID' as const, entitlementsCreated: entitlements.length };
  });
}

/** Provider → server callback. Signature-verified by the gateway before anything else runs. */
export async function processWebhook(request: WebhookRequest) {
  const gateway = getPaymentGateway();
  const result = gateway.verifyWebhook(request);
  if (!result.valid) {
    throw new AppError(ErrorCode.PAYMENT_WEBHOOK_INVALID, 'Webhook signature verification failed', 400);
  }
  if (!result.relevant) {
    // Authentic, but not an event we act on — acknowledge so it isn't retried.
    return { alreadyProcessed: false as const, status: 'IGNORED' as const };
  }

  return applyVerifiedPaymentEvent({
    ...result,
    payload: typeof request.body === 'object' && request.body !== null ? (request.body as Record<string, unknown>) : {},
  });
}

/**
 * Browser → server, after the provider's checkout reports success (ADR-039).
 * The browser's claim is not trusted: the gateway verifies the checkout
 * signature with the key secret, then fetches the payment from the provider
 * server-to-server (capturing it if needed). Only then does it go through
 * the same transactional path as a webhook. The webhook for the same
 * payment, arriving later, is then a harmless no-op (already PAID,
 * entitlements already exist).
 */
export async function verifyCheckoutPayment(input: VerifyPaymentInput, userId: string) {
  const gateway = getPaymentGateway();
  if (!gateway.confirmCheckout) {
    throw new AppError(ErrorCode.NOT_FOUND, 'The configured payment provider has no checkout to verify', 404);
  }

  const payment = await paymentRepo.findPaymentByProviderOrderId(input.providerOrderId);
  if (!payment) {
    throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found for this provider order', 404);
  }
  ensureOwnsOrder(await getOrderOrThrow(payment.orderId), userId);

  const confirmed = await gateway.confirmCheckout(input);

  return applyVerifiedPaymentEvent({
    eventId: `checkout:${confirmed.providerPaymentId}`,
    eventType: 'checkout.verified',
    payload: { providerOrderId: confirmed.providerOrderId, providerPaymentId: confirmed.providerPaymentId },
    providerOrderId: confirmed.providerOrderId,
    providerPaymentId: confirmed.providerPaymentId,
    amount: confirmed.amount,
    currencyCode: confirmed.currencyCode,
    status: 'PAID',
  });
}

/**
 * Dev/test-only: simulates the mock provider calling the webhook, building
 * and signing the exact same payload shape a real provider callback would
 * send, then routes it through the real processWebhook() — the entitlement-
 * creation code path is exercised identically to production, never
 * shortcut. Only works when PAYMENT_PROVIDER=mock (404s otherwise, hiding
 * the endpoint rather than behaving differently).
 */
export async function simulatePayment(paymentId: string, userId: string, outcome: 'PAID' | 'FAILED' = 'PAID') {
  if (env.paymentProvider !== 'mock') {
    throw new AppError(ErrorCode.NOT_FOUND, 'Not found', 404);
  }

  const payment = await paymentRepo.findPaymentById(paymentId);
  if (!payment) {
    throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found', 404);
  }

  const order = await getOrderOrThrow(payment.orderId);
  ensureOwnsOrder(order, userId);

  const { body, signature } = mockPaymentGateway.buildSignedWebhook({
    eventType: outcome === 'PAID' ? 'payment.captured' : 'payment.failed',
    providerOrderId: payment.providerOrderId!,
    providerPaymentId: payment.id,
    amount: Number(order.totalAmount),
    currencyCode: order.currencyCode,
    status: outcome,
  });

  return processWebhook({ body, rawBody: undefined, headers: { 'x-mock-signature': signature } });
}
