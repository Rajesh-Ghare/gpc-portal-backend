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

/** Compares money in integer minor units (paise/cents), never as floats. */
function toMinorUnits(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

/**
 * The only place an order transitions to PAID and entitlements get created
 * from a purchase — never from a client-trusted "payment succeeded"
 * callback (see docs/SECURITY.md). Verifies the signature, then does
 * everything else in **one transaction** (ADR-036): claim the event id
 * (idempotency via payment_webhook_events' unique index), lock the payment
 * and order rows, re-verify amount/currency against the order's own stored
 * total, update payment/order, and create entitlements.
 *
 * Any failure rolls back everything — including the event claim — so the
 * provider's retry reprocesses it rather than being skipped as a
 * duplicate. (Previously the event was recorded first and the rest
 * outside a transaction, so a failure mid-way left a paid order with no
 * entitlement and every retry answered "already processed".)
 */
export async function processWebhook(rawBody: unknown, signatureHeader: string | undefined) {
  const gateway = getPaymentGateway();
  const result = gateway.verifyWebhook(rawBody, signatureHeader);
  if (!result.valid) {
    throw new AppError(ErrorCode.PAYMENT_WEBHOOK_INVALID, 'Webhook signature verification failed', 400);
  }

  return sequelize.transaction(async (transaction) => {
    const eventRowId = await paymentRepo.claimWebhookEvent(
      {
        provider: env.paymentProvider,
        providerEventId: result.eventId,
        eventType: result.eventType,
        payload: typeof rawBody === 'object' && rawBody !== null ? (rawBody as Record<string, unknown>) : {},
      },
      transaction,
    );
    if (!eventRowId) {
      return { alreadyProcessed: true as const };
    }

    // Lock order: payment, then order — the only code path that locks both,
    // so concurrent events (for the same or different payments of one
    // order) serialize without deadlocking.
    const payment = await paymentRepo.findPaymentByProviderOrderIdForUpdate(result.providerOrderId, transaction);
    if (!payment) {
      throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found for this provider order', 404);
    }

    const order = await orderRepo.findOrderByIdForUpdate(payment.orderId, transaction);
    if (!order) {
      throw new AppError(ErrorCode.ORDER_NOT_FOUND, 'Order not found for this payment', 404);
    }

    if (toMinorUnits(order.totalAmount) !== toMinorUnits(result.amount) || order.currencyCode !== result.currencyCode) {
      throw new AppError(ErrorCode.PAYMENT_VERIFICATION_FAILED, 'Webhook amount/currency does not match the order', 422);
    }

    const providerPaymentId = result.providerPaymentId ?? payment.providerPaymentId;

    if (result.status === 'FAILED') {
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
