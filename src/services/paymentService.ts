import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { sequelize } from '../models';
import * as paymentRepo from '../repositories/paymentRepository';
import * as orderRepo from '../repositories/orderRepository';
import { getOrderOrThrow } from './orderService';
import { ensureOwnsOrder } from '../policies/orderPolicy';
import { createEntitlementsForPaidOrder } from './entitlementService';
import { getPaymentGateway } from '../strategies/payment';
import { mockPaymentGateway } from '../strategies/payment/MockPaymentGateway';
import { env } from '../config/env';
import type { createPaymentSchema } from '../validations/payment.validation';

type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/**
 * Creates a PENDING payment for an order via the configured gateway.
 * Idempotent on repeated calls for the same order while one payment is
 * still PENDING — returns the existing attempt rather than creating a
 * second provider-side payment intent.
 */
export async function createPayment(input: CreatePaymentInput, userId: string) {
  const order = await getOrderOrThrow(input.orderId);
  ensureOwnsOrder(order, userId);

  if (order.status === 'PAID') {
    throw new AppError(ErrorCode.ORDER_ALREADY_PAID, 'This order has already been paid', 409);
  }

  const existingPending = await paymentRepo.findPendingPaymentByOrderId(order.id);
  if (existingPending) {
    return existingPending;
  }

  const gateway = getPaymentGateway();
  const result = await gateway.createPayment(order);

  return paymentRepo.createPayment({
    orderId: order.id,
    provider: env.paymentProvider,
    providerPaymentId: result.providerPaymentId,
    providerOrderId: result.providerOrderId,
    status: 'PENDING',
    amount: order.totalAmount,
    currencyCode: order.currencyCode,
    rawResponse: result.raw,
  });
}

/**
 * The only place an order transitions to PAID and entitlements get created
 * from a purchase — never from a client-trusted "payment succeeded"
 * callback (see docs/SECURITY.md). Verifies the signature, rejects/ignores
 * a duplicate provider event (idempotency via payment_webhook_events'
 * unique (provider, provider_event_id) index), and re-verifies the
 * amount/currency against the order's own stored total — never trusts the
 * webhook body's amount blindly.
 */
export async function processWebhook(rawBody: unknown, signatureHeader: string | undefined) {
  const gateway = getPaymentGateway();
  const result = gateway.verifyWebhook(rawBody, signatureHeader);
  if (!result.valid) {
    throw new AppError(ErrorCode.PAYMENT_WEBHOOK_INVALID, 'Webhook signature verification failed', 400);
  }

  const existingEvent = await paymentRepo.findWebhookEvent(env.paymentProvider, result.eventId);
  if (existingEvent) {
    return { alreadyProcessed: true as const };
  }

  const payment = await paymentRepo.findPaymentByProviderOrderId(result.providerOrderId);
  if (!payment) {
    throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found for this provider order', 404);
  }

  const order = await orderRepo.findOrderById(payment.orderId);
  if (!order) {
    throw new AppError(ErrorCode.ORDER_NOT_FOUND, 'Order not found for this payment', 404);
  }

  if (Number(order.totalAmount) !== result.amount || order.currencyCode !== result.currencyCode) {
    throw new AppError(ErrorCode.PAYMENT_VERIFICATION_FAILED, 'Webhook amount/currency does not match the order', 422);
  }

  await paymentRepo.createWebhookEvent({
    provider: env.paymentProvider,
    providerEventId: result.eventId,
    eventType: result.eventType,
    payload: typeof rawBody === 'object' && rawBody !== null ? (rawBody as Record<string, unknown>) : {},
    status: 'PROCESSED',
    processedAt: new Date(),
  });

  if (result.status === 'FAILED') {
    await paymentRepo.updatePayment(payment, {
      status: 'FAILED',
      failedAt: new Date(),
      providerPaymentId: result.providerPaymentId ?? payment.providerPaymentId,
    });
    return { alreadyProcessed: false as const, status: 'FAILED' as const };
  }

  if (payment.status !== 'PAID') {
    await sequelize.transaction(async (transaction) => {
      await payment.update(
        {
          status: 'PAID',
          paidAt: new Date(),
          providerPaymentId: result.providerPaymentId ?? payment.providerPaymentId,
        },
        { transaction },
      );
      if (order.status !== 'PAID') {
        await order.update({ status: 'PAID', paidAt: new Date() }, { transaction });
      }
    });
  }

  const entitlements = await createEntitlementsForPaidOrder(order);

  return { alreadyProcessed: false as const, status: 'PAID' as const, entitlementsCreated: entitlements.length };
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

  return processWebhook(body, signature);
}
