import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { sequelize, User } from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

// Reserved test-only mobile number range — never used by seeders or manual
// testing, to keep this suite's cleanup safe and independent.
const MOBILE_LOGIN = '9700000001';
const MOBILE_WRONG_OTP = '9700000002';
const MOBILE_MAX_ATTEMPTS = '9700000003';
const ALL_TEST_NUMBERS = [MOBILE_LOGIN, MOBILE_WRONG_OTP, MOBILE_MAX_ATTEMPTS];

async function requestAndGetOtp(mobileNumber: string) {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  return otp;
}

describe('Auth flow', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await User.destroy({ where: { mobileNumber: ALL_TEST_NUMBERS }, force: true });
    await sequelize.close();
  });

  it('completes request-otp -> verify-otp -> me -> logout -> rejected', async () => {
    const otp = await requestAndGetOtp(MOBILE_LOGIN);

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ mobileNumber: MOBILE_LOGIN, otp })
      .expect(200);

    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.token).toBeTypeOf('string');
    expect(verifyRes.body.data.user.mobileNumber).toBe(MOBILE_LOGIN);
    const { token } = verifyRes.body.data;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(meRes.body.data.mobileNumber).toBe(MOBILE_LOGIN);
    expect(meRes.body.data.roles).toContain('STUDENT');

    await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);

    const afterLogout = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.errorCode).toBe('AUTH_UNAUTHORIZED');
  });

  it('rejects a request with no bearer token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('AUTH_UNAUTHORIZED');
  });

  it('rejects malformed mobile numbers before hitting the OTP provider', async () => {
    const res = await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber: 'not-a-number' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('rejects an incorrect OTP and still allows the correct one afterward', async () => {
    const otp = await requestAndGetOtp(MOBILE_WRONG_OTP);
    const wrongDigits = otp === '111111' ? '222222' : '111111';

    const wrongRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ mobileNumber: MOBILE_WRONG_OTP, otp: wrongDigits });
    expect(wrongRes.status).toBe(400);
    expect(wrongRes.body.errorCode).toBe('AUTH_OTP_INVALID');

    const rightRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ mobileNumber: MOBILE_WRONG_OTP, otp });
    expect(rightRes.status).toBe(200);
  });

  it('locks out an OTP after the max attempt count, even with the correct code', async () => {
    const otp = await requestAndGetOtp(MOBILE_MAX_ATTEMPTS);
    const wrongDigits = otp === '111111' ? '222222' : '111111';

    // Default OTP_MAX_ATTEMPTS is 5.
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber: MOBILE_MAX_ATTEMPTS, otp: wrongDigits });
    }

    const finalRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ mobileNumber: MOBILE_MAX_ATTEMPTS, otp });
    expect(finalRes.status).toBe(400);
    expect(finalRes.body.message).toMatch(/too many/i);
  });
});
