import type { CreationAttributes, InferAttributes } from 'sequelize';
import { Payment, PaymentWebhookEvent } from '../models';

export async function createPayment(data: CreationAttributes<Payment>) {
  return Payment.create(data);
}

export async function findPaymentById(id: string) {
  return Payment.findByPk(id);
}

export async function findPendingPaymentByOrderId(orderId: string) {
  return Payment.findOne({ where: { orderId, status: 'PENDING' }, order: [['createdAt', 'DESC']] });
}

export async function findPaymentByProviderOrderId(providerOrderId: string) {
  return Payment.findOne({ where: { providerOrderId } });
}

export async function updatePayment(payment: Payment, data: Partial<InferAttributes<Payment>>) {
  payment.set(data);
  await payment.save();
  return payment;
}

export async function findWebhookEvent(provider: string, providerEventId: string) {
  return PaymentWebhookEvent.findOne({ where: { provider, providerEventId } });
}

export async function createWebhookEvent(data: CreationAttributes<PaymentWebhookEvent>) {
  return PaymentWebhookEvent.create(data);
}

export async function markWebhookEventProcessed(event: PaymentWebhookEvent, status: string) {
  event.status = status;
  event.processedAt = new Date();
  await event.save();
  return event;
}
