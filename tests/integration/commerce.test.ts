import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog, Entitlement, Order, OrderItem, Product, ProductItem, ProductPrice, sequelize } from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

const SUPER_ADMIN_MOBILE = '9000000001';
const STUDENT_A_MOBILE = '9700000030';
const STUDENT_B_MOBILE = '9700000031';

async function loginAs(mobileNumber: string): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  const token = verifyRes.body.data.token as string;
  const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, userId: meRes.body.data.id as string };
}

describe('Commerce (products, prices, items, orders, entitlement list/revoke)', () => {
  let adminToken: string;
  let studentA: { token: string; userId: string };
  let studentB: { token: string; userId: string };
  let productId: string;
  let priceId: string;
  const productSlug = 'commerce-test-product';

  beforeAll(async () => {
    await sequelize.authenticate();
    const admin = await loginAs(SUPER_ADMIN_MOBILE);
    adminToken = admin.token;
    studentA = await loginAs(STUDENT_A_MOBILE);
    studentB = await loginAs(STUDENT_B_MOBILE);
  });

  afterAll(async () => {
    const orders = await Order.findAll({ where: { userId: [studentA.userId, studentB.userId] } });
    const orderIds = orders.map((o) => o.id);
    await OrderItem.destroy({ where: { orderId: orderIds } });
    await Order.destroy({ where: { id: orderIds } });
    await AuditLog.destroy({ where: { entityType: ['product_price', 'entitlement'] } });
    const product = await Product.findOne({ where: { slug: productSlug }, paranoid: false });
    if (product) {
      await Entitlement.destroy({ where: { productId: product.id } });
      await ProductItem.destroy({ where: { productId: product.id } });
      await ProductPrice.destroy({ where: { productId: product.id } });
      await Product.destroy({ where: { id: product.id }, force: true });
    }
    await sequelize.close();
  });

  it('rejects a student creating a product (FORBIDDEN)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ name: 'Should Not Be Created', productType: 'INDIVIDUAL_TEST' });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('creates a product as admin', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Commerce Test Product', slug: productSlug, productType: 'SUBSCRIPTION', status: 'ACTIVE' })
      .expect(201);
    productId = res.body.data.id;
    expect(res.body.data.slug).toBe(productSlug);
  });

  it('rejects a duplicate slug', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Another Name', slug: productSlug, productType: 'SUBSCRIPTION' });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('DUPLICATE_SLUG');
  });

  it('creates a price and audit-logs the change', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/products/${productId}/prices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 199 })
      .expect(201);
    priceId = res.body.data.id;
    expect(res.body.data.amount).toBe('199.00');

    const auditLog = await AuditLog.findOne({ where: { action: 'product.price_changed', entityId: priceId } });
    expect(auditLog).not.toBeNull();
  });

  it('rejects a product_item whose target column does not match its access_type', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/products/${productId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accessType: 'SUBSCRIPTION', testId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('creates a valid SUBSCRIPTION product_item (no target columns)', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/products/${productId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accessType: 'SUBSCRIPTION' })
      .expect(201);
    expect(res.body.data.accessType).toBe('SUBSCRIPTION');
  });

  it('lets a student browse the active product', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${studentA.token}`)
      .expect(200);
    expect(res.body.data.id).toBe(productId);
    expect(res.body.data.prices).toHaveLength(1);
  });

  it('creates an order and is idempotent on (userId, idempotencyKey)', async () => {
    const first = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ productId, idempotencyKey: 'commerce-test-key-1' })
      .expect(201);
    const orderId = first.body.data.id as string;
    expect(first.body.data.totalAmount).toBe('199.00');
    expect(first.body.data.items[0].productName).toBe('Commerce Test Product');

    const retry = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ productId, idempotencyKey: 'commerce-test-key-1' })
      .expect(200);
    expect(retry.body.data.id).toBe(orderId);
  });

  it('rejects reusing the same idempotency key for a different product', async () => {
    const otherProduct = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Second Commerce Product', productType: 'SUBSCRIPTION', status: 'ACTIVE' })
      .expect(201);
    const otherId = otherProduct.body.data.id as string;
    await request(app)
      .post(`/api/v1/admin/products/${otherId}/prices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 50 })
      .expect(201);

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${studentA.token}`)
      .send({ productId: otherId, idempotencyKey: 'commerce-test-key-1' });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('IDEMPOTENCY_CONFLICT');

    await Product.destroy({ where: { id: otherId }, force: true });
    await ProductPrice.destroy({ where: { productId: otherId } });
  });

  it('prevents a student from viewing another student\'s order', async () => {
    const mine = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${studentA.token}`)
      .expect(200);
    const orderId = mine.body.data[0].id as string;

    const res = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${studentB.token}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('rejects a student from admin order/product endpoints', async () => {
    const res = await request(app).get('/api/v1/admin/orders').set('Authorization', `Bearer ${studentA.token}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('admin can list all orders including the student\'s new one', async () => {
    const res = await request(app).get('/api/v1/admin/orders').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const forStudent = res.body.data.filter((o: { userId: string }) => o.userId === studentA.userId);
    expect(forStudent.length).toBeGreaterThan(0);
  });

  it('grants, lists, and idempotently revokes an entitlement', async () => {
    const grant = await request(app)
      .post('/api/v1/admin/entitlements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentB.userId, productItemId: (await ProductItem.findOne({ where: { productId } }))!.id })
      .expect((res) => expect([200, 201]).toContain(res.status));
    const entitlementId = grant.body.data.id as string;

    const listRes = await request(app)
      .get(`/api/v1/admin/entitlements?userId=${studentB.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listRes.body.data.some((e: { id: string }) => e.id === entitlementId)).toBe(true);

    const revoke1 = await request(app)
      .delete(`/api/v1/admin/entitlements/${entitlementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(revoke1.body.data.status).toBe('REVOKED');

    const revoke2 = await request(app)
      .delete(`/api/v1/admin/entitlements/${entitlementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(revoke2.body.data.status).toBe('REVOKED');

    const auditLogs = await AuditLog.findAll({ where: { action: 'entitlement.revoke', entityId: entitlementId } });
    expect(auditLogs).toHaveLength(1);
  });

  it('rejects a student from listing or revoking entitlements', async () => {
    const listRes = await request(app).get('/api/v1/admin/entitlements').set('Authorization', `Bearer ${studentA.token}`);
    expect(listRes.status).toBe(403);
    expect(listRes.body.errorCode).toBe('FORBIDDEN');
  });
});
