import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { User, sequelize } from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

const SUPER_ADMIN_MOBILE = '9000000001';
const STUDENT_MOBILE = '9700000050';

async function loginAs(mobileNumber: string): Promise<string> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const res = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  return res.body.data.token as string;
}

describe('Admin student search', () => {
  let adminToken: string;
  let studentToken: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = await loginAs(SUPER_ADMIN_MOBILE);
    studentToken = await loginAs(STUDENT_MOBILE);
  });

  afterAll(async () => {
    await User.destroy({ where: { mobileNumber: STUDENT_MOBILE }, force: true });
    await sequelize.close();
  });

  it('rejects a student from searching', async () => {
    const res = await request(app).get('/api/v1/admin/students').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it("finds a student by mobile number, without leaking non-student users", async () => {
    const res = await request(app)
      .get(`/api/v1/admin/students?search=${STUDENT_MOBILE}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.some((u: { mobileNumber: string }) => u.mobileNumber === STUDENT_MOBILE)).toBe(true);
    expect(res.body.data.every((u: Record<string, unknown>) => !('passwordHash' in u))).toBe(true);

    const adminSearch = await request(app)
      .get(`/api/v1/admin/students?search=${SUPER_ADMIN_MOBILE}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminSearch.body.data).toHaveLength(0);
  });
});
