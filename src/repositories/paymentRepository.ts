import type { CreationAttributes, InferAttributes, Transaction } from 'sequelize';
import { Payment, PaymentWebhookEvent, sequelize } from '../models';

export async function createPayment(data: CreationAttributes<Payment>) {
  return Payment.create(data);
}

export async function findPaymentById(id: string) {
  return Payment.findByPk(id);
}

export async function findPendingPaymentByOrderId(orderId: string) {
  return Payment.findOne({ where: { orderId, status: 'PENDING' }, order: [['createdAt', 'DESC']] });
}

export async function findPaymentByProviderOrderIdForUpdate(providerOrderId: string, transaction: Transaction) {
  return Payment.findOne({ where: { providerOrderId }, transaction, lock: transaction.LOCK.UPDATE });
}

export async function updatePayment(
  payment: Payment,
  data: Partial<InferAttributes<Payment>>,
  transaction?: Transaction,
) {
  payment.set(data);
  await payment.save({ transaction });
  return payment;
}

export interface ClaimWebhookEventInput {
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Inserts the event row as RECEIVED, or returns null if this
 * (provider, provider_event_id) already exists. The unique index is the
 * idempotency lock: a concurrent duplicate delivery blocks on it until the
 * first transaction ends, then sees the committed row (→ null) — or, if the
 * first rolled back, claims the event itself. `ON CONFLICT DO NOTHING`
 * rather than catching a unique violation, which would abort the whole
 * Postgres transaction.
 */
export async function claimWebhookEvent(input: ClaimWebhookEventInput, transaction: Transaction) {
  const [rows] = await sequelize.query(
    `INSERT INTO payment_webhook_events (id, provider, provider_event_id, event_type, payload, status, created_at)
     VALUES (gen_random_uuid(), :provider, :providerEventId, :eventType, CAST(:payload AS jsonb), 'RECEIVED', NOW())
     ON CONFLICT (provider, provider_event_id) DO NOTHING
     RETURNING id`,
    {
      replacements: { ...input, payload: JSON.stringify(input.payload) },
      transaction,
    },
  );
  const row = (rows as { id: string }[])[0];
  return row ? row.id : null;
}

export async function markWebhookEventProcessed(id: string, status: 'PROCESSED' | 'IGNORED', transaction: Transaction) {
  await PaymentWebhookEvent.update({ status, processedAt: new Date() }, { where: { id }, transaction });
}
