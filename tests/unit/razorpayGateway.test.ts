import { createHmac } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '../../src/models';
import { RazorpayPaymentGateway, type RazorpayApi } from '../../src/strategies/payment/RazorpayPaymentGateway';
import { AppError } from '../../src/errors/AppError';

const KEY_SECRET = 'unit_test_key_secret';
const WEBHOOK_SECRET = 'unit_test_webhook_secret';

function fakeApi(overrides: Partial<{ create: unknown; fetch: unknown; capture: unknown }> = {}) {
  return {
    orders: { create: vi.fn(overrides.create as never ?? (async () => ({ id: 'order_RZP1', amount: 2500 }))) },
    payments: {
      fetch: vi.fn(overrides.fetch as never),
      capture: vi.fn(overrides.capture as never),
    },
  } satisfies RazorpayApi;
}

function gatewayWith(api: RazorpayApi, webhookSecret: string | null = WEBHOOK_SECRET) {
  return new RazorpayPaymentGateway({ keyId: 'rzp_test_unit', keySecret: KEY_SECRET, webhookSecret }, api);
}

const order = { id: 'o-1', orderNumber: 'ORD-1-ABC', totalAmount: '25.00', currencyCode: 'INR' } as Order;
const checkoutSignature = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

async function expectAppError(promise: Promise<unknown>, errorCode: string, statusCode: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).errorCode).toBe(errorCode);
  expect((err as AppError).statusCode).toBe(statusCode);
}

describe('RazorpayPaymentGateway.createPayment', () => {
  it('creates a Razorpay order in paise with the order number as receipt', async () => {
    const api = fakeApi();
    const result = await gatewayWith(api).createPayment(order);
    expect(api.orders.create).toHaveBeenCalledWith({
      amount: 2500,
      currency: 'INR',
      receipt: 'ORD-1-ABC',
      notes: { orderId: 'o-1' },
    });
    expect(result.providerOrderId).toBe('order_RZP1');
  });

  it('rejects amounts below 100 paise without calling Razorpay', async () => {
    const api = fakeApi();
    await expectAppError(gatewayWith(api).createPayment({ ...order, totalAmount: '0.99' } as Order), 'VALIDATION_ERROR', 422);
    expect(api.orders.create).not.toHaveBeenCalled();
  });

  it('maps a Razorpay auth failure to 502, never 401 (which would log the student out)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = fakeApi({
      create: async () => {
        throw { statusCode: 401, error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } };
      },
    });
    await expectAppError(gatewayWith(api).createPayment(order), 'PAYMENT_PROVIDER_ERROR', 502);
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/RAZORPAY_KEY_ID/));
  });
});

describe('RazorpayPaymentGateway.confirmCheckout', () => {
  const captured = { id: 'pay_1', order_id: 'order_RZP1', amount: 2500, currency: 'INR', status: 'captured' };

  it('accepts a valid signature for a captured payment, without re-capturing', async () => {
    const api = fakeApi({ fetch: async () => captured });
    const result = await gatewayWith(api).confirmCheckout({
      providerOrderId: 'order_RZP1',
      providerPaymentId: 'pay_1',
      signature: checkoutSignature('order_RZP1', 'pay_1'),
    });
    expect(result).toEqual({ providerOrderId: 'order_RZP1', providerPaymentId: 'pay_1', amount: 25, currencyCode: 'INR' });
    expect(api.payments.capture).not.toHaveBeenCalled();
  });

  it('rejects a wrong signature before asking Razorpay anything', async () => {
    const api = fakeApi({ fetch: async () => captured });
    await expectAppError(
      gatewayWith(api).confirmCheckout({ providerOrderId: 'order_RZP1', providerPaymentId: 'pay_1', signature: 'forged' }),
      'PAYMENT_VERIFICATION_FAILED',
      400,
    );
    expect(api.payments.fetch).not.toHaveBeenCalled();
  });

  it('rejects a validly-signed payment id that belongs to a different order', async () => {
    const api = fakeApi({ fetch: async () => ({ ...captured, order_id: 'order_OTHER' }) });
    await expectAppError(
      gatewayWith(api).confirmCheckout({
        providerOrderId: 'order_RZP1',
        providerPaymentId: 'pay_1',
        signature: checkoutSignature('order_RZP1', 'pay_1'),
      }),
      'PAYMENT_VERIFICATION_FAILED',
      400,
    );
  });

  it('captures an authorized payment', async () => {
    const api = fakeApi({
      fetch: async () => ({ ...captured, status: 'authorized' }),
      capture: async () => captured,
    });
    await gatewayWith(api).confirmCheckout({
      providerOrderId: 'order_RZP1',
      providerPaymentId: 'pay_1',
      signature: checkoutSignature('order_RZP1', 'pay_1'),
    });
    expect(api.payments.capture).toHaveBeenCalledWith('pay_1', 2500, 'INR');
  });

  it('rejects a payment that is not captured (e.g. failed)', async () => {
    const api = fakeApi({ fetch: async () => ({ ...captured, status: 'failed' }) });
    await expectAppError(
      gatewayWith(api).confirmCheckout({
        providerOrderId: 'order_RZP1',
        providerPaymentId: 'pay_1',
        signature: checkoutSignature('order_RZP1', 'pay_1'),
      }),
      'PAYMENT_VERIFICATION_FAILED',
      400,
    );
  });
});

describe('RazorpayPaymentGateway.verifyWebhook', () => {
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_9', order_id: 'order_RZP9', amount: 2500, currency: 'INR', status: 'captured' } } },
  });
  const sign = (raw: string, secret = WEBHOOK_SECRET) => createHmac('sha256', secret).update(raw).digest('hex');
  const request = (raw: string, signature: string, eventId = 'evt_1') => ({
    rawBody: Buffer.from(raw),
    body: JSON.parse(raw),
    headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
  });

  it('accepts a correctly-signed payment.captured and normalizes it (paise → rupees)', () => {
    const result = gatewayWith(fakeApi()).verifyWebhook(request(body, sign(body)));
    expect(result).toMatchObject({
      valid: true,
      relevant: true,
      eventId: 'evt_1',
      providerOrderId: 'order_RZP9',
      providerPaymentId: 'pay_9',
      amount: 25,
      currencyCode: 'INR',
      status: 'PAID',
    });
  });

  it('rejects a body altered after signing', () => {
    const tampered = body.replace('2500', '1');
    expect(gatewayWith(fakeApi()).verifyWebhook(request(tampered, sign(body))).valid).toBe(false);
  });

  it('rejects everything when no webhook secret is configured', () => {
    expect(gatewayWith(fakeApi(), null).verifyWebhook(request(body, sign(body))).valid).toBe(false);
  });

  it('marks authentic events it does not act on as irrelevant', () => {
    const orderPaid = JSON.stringify({ event: 'order.paid', payload: {} });
    const result = gatewayWith(fakeApi()).verifyWebhook(request(orderPaid, sign(orderPaid)));
    expect(result).toMatchObject({ valid: true, relevant: false, eventType: 'order.paid' });
  });
});
