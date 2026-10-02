import { createHmac } from 'crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Before src/config/env.ts loads: select Razorpay with fake credentials.
// The real Razorpay API is never called — its client is stubbed below.
vi.hoisted(() => {
  process.env.PAYMENT_PROVIDER = 'razorpay';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_integration';
  process.env.RAZORPAY_KEY_SECRET = 'integration_key_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'integration_webhook_secret';
});

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
import { getPaymentGateway } from '../../src/strategies/payment';
import type { RazorpayPaymentGateway } from '../../src/strategies/payment/RazorpayPaymentGateway';

const app = createApp();
const gateway = getPaymentGateway() as RazorpayPaymentGateway;

const STUDENT_A_MOBILE = '9700000060';
const STUDENT_B_MOBILE = '9700000061';

async function loginAs(mobileNumber: string) {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber)!;
  const res = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  return { token: res.body.data.token as string, userId: res.body.data.user.id as string };
}

const checkoutSignature = (orderId: string, paymentId: string) =>
  createHmac('sha256', 'integration_key_secret').update(`${orderId}|${paymentId}`).digest('hex');
const webhookSignature = (raw: string) => createHmac('sha256', 'integration_webhook_secret').update(raw).digest('hex');

let rzpOrderSeq = 0;

describe('Razorpay checkout (create → verify, webhook backup)', () => {
  let studentA: { token: string; userId: string };
  let studentB: { token: string; userId: string };
  let productId: string;
  const orderIds: string[] = [];
  const rzpOrderIds: string[] = [];

  beforeAll(async () => {
    await sequelize.authenticate();
    studentA = await loginAs(STUDENT_A_MOBILE);
    studentB = await loginAs(STUDENT_B_MOBILE);

    const product = await Product.create({
      name: 'Razorpay Test Product',
      slug: `razorpay-test-${Date.now()}`,
      productType: 'SUBSCRIPTION',
      status: 'ACTIVE',
      createdBy: studentA.userId,
    });
    productId = product.id;
    await ProductPrice.create({ productId, amount: '25.00' });
    await ProductItem.create({ productId, accessType: 'SUBSCRIPTION' });

    vi.spyOn(gateway.api.orders, 'create').mockImplementation(async (params) => {
      const id = `order_TEST${Date.now()}${(rzpOrderSeq += 1)}`;
      rzpOrderIds.push(id);
      return { id, amount: params.amount, currency: params.currency, receipt: params.receipt, status: 'created' };
    });
  });

  afterEach(() => {
    vi.mocked(gateway.api.payments.fetch).mockReset?.();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await PaymentWebhookEvent.destroy({ where: { provider: 'razorpay' } });
    await Payment.destroy({ where: { orderId: orderIds } });
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

  async function createOrderAndPayment(token: string, key: string) {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, idempotencyKey: `${key}-${Date.now()}` });
    orderIds.push(orderRes.body.data.id);
    const paymentRes = await request(app)
      .post('/api/v1/payments/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: orderRes.body.data.id })
      .expect(201);
    return { orderId: orderRes.body.data.id as string, payment: paymentRes.body.data };
  }

  function stubRazorpayPayment(paymentId: string, orderId: string, status = 'captured', amount = 2500) {
    vi.spyOn(gateway.api.payments, 'fetch').mockResolvedValue({ id: paymentId, order_id: orderId, amount, currency: 'INR', status });
  }

  function verify(token: string, body: Record<string, string>) {
    return request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${token}`).send(body);
  }

  it('create-payment returns the public checkout options (key id, Razorpay order, paise) — never the secret', async () => {
    const { payment } = await createOrderAndPayment(studentA.token, 'rzp-create');
    expect(payment.provider).toBe('razorpay');
    expect(payment.checkout).toEqual({
      keyId: 'rzp_test_integration',
      orderId: payment.providerOrderId,
      amount: 2500,
      currency: 'INR',
    });
    expect(JSON.stringify(payment)).not.toContain('integration_key_secret');
    expect(JSON.stringify(payment)).not.toContain('integration_webhook_secret');
  });

  it('verify: a valid signature for a captured payment marks the order PAID and grants access', async () => {
    const { orderId, payment } = await createOrderAndPayment(studentA.token, 'rzp-verify-ok');
    stubRazorpayPayment('pay_OK1', payment.providerOrderId);

    const res = await verify(studentA.token, {
      providerOrderId: payment.providerOrderId,
      providerPaymentId: 'pay_OK1',
      signature: checkoutSignature(payment.providerOrderId, 'pay_OK1'),
    }).expect(200);
    expect(res.body.data).toMatchObject({ alreadyProcessed: false, status: 'PAID', entitlementsCreated: 1 });

    expect((await Order.findByPk(orderId))!.status).toBe('PAID');
    const paymentRow = await Payment.findByPk(payment.id);
    expect(paymentRow!.status).toBe('PAID');
    expect(paymentRow!.providerPaymentId).toBe('pay_OK1');
    expect(await Entitlement.count({ where: { orderId } })).toBe(1);
  });

  it('verify: a forged signature is rejected with 400 and nothing is marked paid', async () => {
    const { orderId, payment } = await createOrderAndPayment(studentB.token, 'rzp-verify-forged');
    const fetchSpy = vi.spyOn(gateway.api.payments, 'fetch');

    const res = await verify(studentB.token, {
      providerOrderId: payment.providerOrderId,
      providerPaymentId: 'pay_FAKE',
      signature: 'a'.repeat(64),
    });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('PAYMENT_VERIFICATION_FAILED');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await Order.findByPk(orderId))!.status).toBe('PENDING');
    expect(await Entitlement.count({ where: { orderId } })).toBe(0);
  });

  it('verify: missing fields are rejected before anything runs', async () => {
    const res = await verify(studentB.token, { providerOrderId: 'order_x' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it("verify: a student cannot confirm another student's order", async () => {
    const { payment } = await createOrderAndPayment(studentA.token, 'rzp-verify-owner');
    const res = await verify(studentB.token, {
      providerOrderId: payment.providerOrderId,
      providerPaymentId: 'pay_X',
      signature: checkoutSignature(payment.providerOrderId, 'pay_X'),
    });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('verify: a signed but not-captured (failed) payment is not marked paid', async () => {
    const { orderId, payment } = await createOrderAndPayment(studentB.token, 'rzp-verify-notcaptured');
    stubRazorpayPayment('pay_FAILED', payment.providerOrderId, 'failed');
    const res = await verify(studentB.token, {
      providerOrderId: payment.providerOrderId,
      providerPaymentId: 'pay_FAILED',
      signature: checkoutSignature(payment.providerOrderId, 'pay_FAILED'),
    });
    expect(res.status).toBe(400);
    expect((await Order.findByPk(orderId))!.status).toBe('PENDING');
  });

  it('webhook (raw-body signature) grants access when the browser never called verify, and a later verify is a no-op', async () => {
    const { orderId, payment } = await createOrderAndPayment(studentB.token, 'rzp-webhook');
    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_WH1', order_id: payment.providerOrderId, amount: 2500, currency: 'INR', status: 'captured' },
        },
      },
    });

    const webhookRes = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', webhookSignature(raw))
      .set('X-Razorpay-Event-Id', `evt_${Date.now()}`)
      .send(raw)
      .expect(200);
    expect(webhookRes.body.data).toMatchObject({ status: 'PAID', entitlementsCreated: 1 });
    expect((await Order.findByPk(orderId))!.status).toBe('PAID');

    // Browser comes back late: verified again, but grants nothing twice.
    stubRazorpayPayment('pay_WH1', payment.providerOrderId);
    const verifyRes = await verify(studentB.token, {
      providerOrderId: payment.providerOrderId,
      providerPaymentId: 'pay_WH1',
      signature: checkoutSignature(payment.providerOrderId, 'pay_WH1'),
    }).expect(200);
    expect(verifyRes.body.data).toMatchObject({ status: 'PAID', entitlementsCreated: 0 });
    expect(await Entitlement.count({ where: { orderId } })).toBe(1);
  });

  it('webhook: a body altered after signing is rejected', async () => {
    const raw = JSON.stringify({ event: 'payment.captured', payload: {} });
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', webhookSignature(raw))
      .send(raw.replace('captured', 'failed'));
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('PAYMENT_WEBHOOK_INVALID');
  });

  it('webhook: authentic events we do not act on are acknowledged (200) without recording anything', async () => {
    const eventId = `evt_orderpaid_${Date.now()}`;
    const raw = JSON.stringify({ event: 'order.paid', payload: {} });
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', webhookSignature(raw))
      .set('X-Razorpay-Event-Id', eventId)
      .send(raw)
      .expect(200);
    expect(res.body.data.status).toBe('IGNORED');
    expect(await PaymentWebhookEvent.count({ where: { providerEventId: eventId } })).toBe(0);
  });

  it('the mock-only simulate endpoint is hidden when Razorpay is configured', async () => {
    const { payment } = await createOrderAndPayment(studentA.token, 'rzp-simulate');
    const res = await request(app)
      .post(`/api/v1/payments/${payment.id}/simulate`)
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ outcome: 'PAID' });
    expect(res.status).toBe(404);
  });
});
