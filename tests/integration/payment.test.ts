import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import {
  AuditLog,
  Entitlement,
  Order,
  OrderItem,
  Payment,
  PaymentWebhookEvent,
  Product,
  ProductItem,
  ProductPrice,
  sequelize,
} from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';
import { mockPaymentGateway } from '../../src/strategies/payment/MockPaymentGateway';

const app = createApp();

const STUDENT_A_MOBILE = '9700000040';
const STUDENT_B_MOBILE = '9700000041';
const STUDENT_C_MOBILE = '9700000042';
const STUDENT_D_MOBILE = '9700000043';

async function loginAs(mobileNumber: string): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  const token = verifyRes.body.data.token as string;
  const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, userId: meRes.body.data.id as string };
}

describe('Payments (mock gateway, webhook verification, entitlement creation)', () => {
  let studentA: { token: string; userId: string };
  let studentB: { token: string; userId: string };
  let studentC: { token: string; userId: string };
  let studentD: { token: string; userId: string };
  let productId: string;
  const orderIds: string[] = [];
  const eventIds: string[] = [];

  beforeAll(async () => {
    await sequelize.authenticate();
    studentA = await loginAs(STUDENT_A_MOBILE);
    studentB = await loginAs(STUDENT_B_MOBILE);
    studentC = await loginAs(STUDENT_C_MOBILE);
    studentD = await loginAs(STUDENT_D_MOBILE);

    const product = await Product.create({
      name: 'Payment Test Subscription',
      slug: `payment-test-subscription-${Date.now()}`,
      productType: 'SUBSCRIPTION',
      status: 'ACTIVE',
      createdBy: studentA.userId,
    });
    productId = product.id;
    await ProductPrice.create({ productId, amount: '25.00' });
    await ProductItem.create({ productId, accessType: 'SUBSCRIPTION' });
  });

  afterAll(async () => {
    await PaymentWebhookEvent.destroy({ where: { providerEventId: eventIds } });
    const payments = await Payment.findAll({ where: { orderId: orderIds } });
    await Payment.destroy({ where: { id: payments.map((p) => p.id) } });
    await OrderItem.destroy({ where: { orderId: orderIds } });
    await Order.destroy({ where: { id: orderIds } });
    const entitlements = await Entitlement.findAll({ where: { productId } });
    await AuditLog.destroy({ where: { entityId: entitlements.map((e) => e.id) } });
    await Entitlement.destroy({ where: { productId } });
    await ProductItem.destroy({ where: { productId } });
    await ProductPrice.destroy({ where: { productId } });
    await Product.destroy({ where: { id: productId }, force: true });
    await sequelize.close();
  });

  async function createOrder(token: string, idempotencyKey: string) {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, idempotencyKey })
      .expect((r) => expect([200, 201]).toContain(r.status));
    orderIds.push(res.body.data.id);
    return res.body.data as { id: string; totalAmount: string; currencyCode: string };
  }

  it('creates a PENDING payment for an order via POST /payments/create', async () => {
    const order = await createOrder(studentA.token, 'payment-key-create');
    const res = await request(app)
      .post('/api/v1/payments/create')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ orderId: order.id })
      .expect(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.provider).toBe('mock');
    expect(res.body.data.providerOrderId).toBe(`mock_order_${order.id}`);
  });

  it('is idempotent: a second create-payment call for the same order returns the existing PENDING payment', async () => {
    const order = await createOrder(studentA.token, 'payment-key-idempotent');
    const first = await request(app)
      .post('/api/v1/payments/create')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ orderId: order.id })
      .expect(201);
    const second = await request(app)
      .post('/api/v1/payments/create')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ orderId: order.id })
      .expect(201);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('rejects a student creating a payment for another student\'s order', async () => {
    const order = await createOrder(studentA.token, 'payment-key-ownership');
    const res = await request(app)
      .post('/api/v1/payments/create')
      .set('Authorization', `Bearer ${studentB.token}`)
      .send({ orderId: order.id });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('rejects a webhook with no/invalid signature without touching any state', async () => {
    const order = await createOrder(studentA.token, 'payment-key-badsig');
    const payment = (
      await request(app)
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ orderId: order.id })
        .expect(201)
    ).body.data;

    const { body } = mockPaymentGateway.buildSignedWebhook({
      eventType: 'payment.captured',
      providerOrderId: payment.providerOrderId,
      providerPaymentId: null,
      amount: 25,
      currencyCode: 'INR',
      status: 'PAID',
    });
    eventIds.push(body.eventId);

    const res = await request(app).post('/api/v1/payments/webhook').set('x-mock-signature', 'not-a-real-signature').send(body);
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('PAYMENT_WEBHOOK_INVALID');

    const orderAfter = await Order.findByPk(order.id);
    expect(orderAfter!.status).toBe('PENDING');
  });

  it('rejects a validly-signed webhook whose amount does not match the order (no state change)', async () => {
    const order = await createOrder(studentA.token, 'payment-key-amount-mismatch');
    const payment = (
      await request(app)
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ orderId: order.id })
        .expect(201)
    ).body.data;

    const { body, signature } = mockPaymentGateway.buildSignedWebhook({
      eventType: 'payment.captured',
      providerOrderId: payment.providerOrderId,
      providerPaymentId: null,
      amount: 999999,
      currencyCode: 'INR',
      status: 'PAID',
    });
    eventIds.push(body.eventId);

    const res = await request(app).post('/api/v1/payments/webhook').set('x-mock-signature', signature).send(body);
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('PAYMENT_VERIFICATION_FAILED');

    const orderAfter = await Order.findByPk(order.id);
    expect(orderAfter!.status).toBe('PENDING');
    expect(await PaymentWebhookEvent.count({ where: { providerEventId: body.eventId } })).toBe(0);
  });

  it('rejects another student simulating this student\'s payment', async () => {
    const order = await createOrder(studentA.token, 'payment-key-sim-ownership');
    const payment = (
      await request(app)
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ orderId: order.id })
        .expect(201)
    ).body.data;

    const res = await request(app)
      .post(`/api/v1/payments/${payment.id}/simulate`)
      .set('Authorization', `Bearer ${studentB.token}`)
      .send({ outcome: 'PAID' });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('completes the full purchase flow: simulate PAID marks the order paid and creates an entitlement', async () => {
    const order = await createOrder(studentA.token, 'payment-key-success');
    const payment = (
      await request(app)
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ orderId: order.id })
        .expect(201)
    ).body.data;

    const simRes = await request(app)
      .post(`/api/v1/payments/${payment.id}/simulate`)
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ outcome: 'PAID' })
      .expect(200);
    expect(simRes.body.data).toMatchObject({ alreadyProcessed: false, status: 'PAID', entitlementsCreated: 1 });

    const orderAfter = await Order.findByPk(order.id);
    expect(orderAfter!.status).toBe('PAID');
    expect(orderAfter!.paidAt).not.toBeNull();

    const paymentAfter = await Payment.findByPk(payment.id);
    expect(paymentAfter!.status).toBe('PAID');

    const entitlement = await Entitlement.findOne({ where: { userId: studentA.userId, productId } });
    expect(entitlement).not.toBeNull();
    expect(entitlement!.status).toBe('ACTIVE');
    expect(entitlement!.orderId).toBe(order.id);

    const auditLog = await AuditLog.findOne({ where: { action: 'entitlement.grant', entityId: entitlement!.id } });
    expect(auditLog).not.toBeNull();
    expect(auditLog!.actorId).toBeNull();
  });

  it('rejects creating a payment for an already-PAID order', async () => {
    const order = await createOrder(studentA.token, 'payment-key-already-paid');
    const payment = (
      await request(app)
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ orderId: order.id })
        .expect(201)
    ).body.data;
    await request(app)
      .post(`/api/v1/payments/${payment.id}/simulate`)
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ outcome: 'PAID' })
      .expect(200);

    const res = await request(app)
      .post('/api/v1/payments/create')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ orderId: order.id });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('ORDER_ALREADY_PAID');
  });

  it('ignores a replayed webhook event (same provider + eventId) without duplicating anything', async () => {
    const order = await createOrder(studentB.token, 'payment-key-replay');
    const payment = (
      await request(app)
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({ orderId: order.id })
        .expect(201)
    ).body.data;

    const { body, signature } = mockPaymentGateway.buildSignedWebhook({
      eventType: 'payment.captured',
      providerOrderId: payment.providerOrderId,
      providerPaymentId: null,
      amount: 25,
      currencyCode: 'INR',
      status: 'PAID',
    });
    eventIds.push(body.eventId);

    const first = await request(app).post('/api/v1/payments/webhook').set('x-mock-signature', signature).send(body).expect(200);
    expect(first.body.data.alreadyProcessed).toBe(false);

    const replay = await request(app).post('/api/v1/payments/webhook').set('x-mock-signature', signature).send(body).expect(200);
    expect(replay.body.data).toEqual({ alreadyProcessed: true });

    const events = await PaymentWebhookEvent.findAll({ where: { providerEventId: body.eventId } });
    expect(events).toHaveLength(1);
  });

  it('marks the payment FAILED (order stays PENDING) when the simulated outcome is FAILED', async () => {
    const order = await createOrder(studentA.token, 'payment-key-failed');
    const payment = (
      await request(app)
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ orderId: order.id })
        .expect(201)
    ).body.data;

    const res = await request(app)
      .post(`/api/v1/payments/${payment.id}/simulate`)
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ outcome: 'FAILED' })
      .expect(200);
    expect(res.body.data).toEqual({ alreadyProcessed: false, status: 'FAILED' });

    const orderAfter = await Order.findByPk(order.id);
    expect(orderAfter!.status).toBe('PENDING');

    const paymentAfter = await Payment.findByPk(payment.id);
    expect(paymentAfter!.status).toBe('FAILED');
  });

  async function createPendingPayment(token: string, idempotencyKey: string) {
    const order = await createOrder(token, idempotencyKey);
    const payment = (
      await request(app).post('/api/v1/payments/create').set('Authorization', `Bearer ${token}`).send({ orderId: order.id }).expect(201)
    ).body.data as { id: string; providerOrderId: string };
    return { order, payment };
  }

  function signedEvent(providerOrderId: string, status: 'PAID' | 'FAILED') {
    const signed = mockPaymentGateway.buildSignedWebhook({
      eventType: status === 'PAID' ? 'payment.captured' : 'payment.failed',
      providerOrderId,
      providerPaymentId: null,
      amount: 25,
      currencyCode: 'INR',
      status,
    });
    eventIds.push(signed.body.eventId);
    return signed;
  }

  function deliver({ body, signature }: { body: object; signature: string }) {
    return request(app).post('/api/v1/payments/webhook').set('x-mock-signature', signature).send(body);
  }

  it('rolls back everything if granting access fails, so the provider retry still grants it', async () => {
    const { order, payment } = await createPendingPayment(studentC.token, 'payment-key-rollback');
    const event = signedEvent(payment.providerOrderId, 'PAID');

    const spy = vi.spyOn(Entitlement, 'create').mockRejectedValueOnce(new Error('simulated DB failure'));
    const failed = await deliver(event);
    spy.mockRestore();
    expect(failed.status).toBe(500);

    // Nothing persisted — in particular no event row, which used to make the
    // retry below answer "already processed" and leave the student without access.
    expect(await PaymentWebhookEvent.count({ where: { providerEventId: event.body.eventId } })).toBe(0);
    expect((await Order.findByPk(order.id))!.status).toBe('PENDING');
    expect((await Payment.findByPk(payment.id))!.status).toBe('PENDING');
    expect(await Entitlement.count({ where: { orderId: order.id } })).toBe(0);

    const retry = await deliver(event).expect(200);
    expect(retry.body.data).toMatchObject({ alreadyProcessed: false, status: 'PAID', entitlementsCreated: 1 });
    expect((await Order.findByPk(order.id))!.status).toBe('PAID');
    expect((await Payment.findByPk(payment.id))!.status).toBe('PAID');
    expect(await Entitlement.count({ where: { orderId: order.id } })).toBe(1);
    const eventRow = await PaymentWebhookEvent.findOne({ where: { providerEventId: event.body.eventId } });
    expect(eventRow!.status).toBe('PROCESSED');
    expect(eventRow!.processedAt).not.toBeNull();
  });

  it('processes concurrent duplicate deliveries of one event exactly once', async () => {
    const { order } = await createPendingPayment(studentD.token, 'payment-key-concurrent');
    const payment = await Payment.findOne({ where: { orderId: order.id } });
    const event = signedEvent(payment!.providerOrderId!, 'PAID');

    const responses = await Promise.all([deliver(event), deliver(event), deliver(event)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(responses.filter((r) => r.body.data.alreadyProcessed === false)).toHaveLength(1);
    expect(responses.filter((r) => r.body.data.alreadyProcessed === true)).toHaveLength(2);

    expect(await PaymentWebhookEvent.count({ where: { providerEventId: event.body.eventId } })).toBe(1);
    expect(await Entitlement.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('ignores a failure event that arrives after the payment was captured (never un-pays)', async () => {
    const { order, payment } = await createPendingPayment(studentB.token, 'payment-key-late-failure');
    await deliver(signedEvent(payment.providerOrderId, 'PAID')).expect(200);

    const lateFailure = signedEvent(payment.providerOrderId, 'FAILED');
    const res = await deliver(lateFailure).expect(200);
    expect(res.body.data).toEqual({ alreadyProcessed: false, status: 'IGNORED' });

    expect((await Payment.findByPk(payment.id))!.status).toBe('PAID');
    expect((await Order.findByPk(order.id))!.status).toBe('PAID');
    const eventRow = await PaymentWebhookEvent.findOne({ where: { providerEventId: lateFailure.body.eventId } });
    expect(eventRow!.status).toBe('IGNORED');
  });
});
