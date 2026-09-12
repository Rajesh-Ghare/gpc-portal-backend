import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { CompetitiveExam, ExamCategory, sequelize } from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

// Seeded users from src/seeders/20260913100002-users.js.
const SUPER_ADMIN_MOBILE = '9000000001';
const STUDENT_MOBILE = '9000000003';

async function loginAs(mobileNumber: string): Promise<string> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const res = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  return res.body.data.token as string;
}

describe('Exam catalog admin CRUD', () => {
  let adminToken: string;
  let studentToken: string;
  const createdCategorySlugs = ['catalog-test-category'];

  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = await loginAs(SUPER_ADMIN_MOBILE);
    studentToken = await loginAs(STUDENT_MOBILE);
  });

  afterAll(async () => {
    await CompetitiveExam.destroy({ where: { slug: 'catalog-test-exam' }, force: true });
    await ExamCategory.destroy({ where: { slug: createdCategorySlugs }, force: true });
    await sequelize.close();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/admin/categories');
    expect(res.status).toBe(401);
  });

  it('rejects a STUDENT (no catalog.* permissions) with FORBIDDEN', async () => {
    const res = await request(app).get('/api/v1/admin/categories').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('lets a SUPER_ADMIN create a category with an auto-generated slug', async () => {
    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Catalog Test Category' })
      .expect(201);

    expect(res.body.data.slug).toBe('catalog-test-category');
  });

  it('rejects a duplicate slug', async () => {
    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Catalog Test Category' });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('DUPLICATE_SLUG');
  });

  it('creates a competitive exam under the category, and rejects an unknown categoryId', async () => {
    const category = await ExamCategory.findOne({ where: { slug: 'catalog-test-category' } });
    if (!category) throw new Error('setup failed: category not found');

    const okRes = await request(app)
      .post('/api/v1/admin/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: category.id, name: 'Catalog Test Exam' })
      .expect(201);
    expect(okRes.body.data.slug).toBe('catalog-test-exam');

    const badRes = await request(app)
      .post('/api/v1/admin/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: '00000000-0000-0000-0000-000000000000', name: 'Orphan Exam' });
    expect(badRes.status).toBe(404);
    expect(badRes.body.errorCode).toBe('CATEGORY_NOT_FOUND');
  });

  it('soft-deletes a category (subsequent GET returns 404, row still exists in DB)', async () => {
    const category = await ExamCategory.create({ name: 'Delete Me', slug: 'delete-me-category' });

    await request(app)
      .delete(`/api/v1/admin/categories/${category.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const getRes = await request(app)
      .get(`/api/v1/admin/categories/${category.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);

    const rawRow = await ExamCategory.findOne({ where: { slug: 'delete-me-category' }, paranoid: false });
    expect(rawRow).not.toBeNull();
    expect(rawRow?.deletedAt).not.toBeNull();

    await ExamCategory.destroy({ where: { slug: 'delete-me-category' }, force: true });
  });
});
