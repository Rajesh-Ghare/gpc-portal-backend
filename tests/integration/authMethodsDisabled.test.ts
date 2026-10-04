import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

// Before env.ts loads: only email sign-in enabled, as in production today.
vi.hoisted(() => {
  process.env.AUTH_METHODS = 'email_otp';
});

import { createApp } from '../../src/app';
import { sequelize } from '../../src/models';

const app = createApp();

describe('AUTH_METHODS gate (ADR-040)', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('advertises only the enabled methods, and no Google client id', async () => {
    const res = await request(app).get('/api/v1/auth/methods').expect(200);
    expect(res.body.data).toEqual({ methods: ['email_otp'], googleClientId: null });
  });

  it('disabled mobile OTP endpoints cannot be called directly (not just hidden in the UI)', async () => {
    for (const path of ['/api/v1/auth/request-otp', '/api/v1/auth/verify-otp']) {
      const res = await request(app).post(path).send({ mobileNumber: '9700000999', otp: '123456' });
      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('AUTH_METHOD_DISABLED');
    }
  });

  it('disabled Google sign-in cannot be called directly', async () => {
    const res = await request(app).post('/api/v1/auth/google').send({ credential: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('AUTH_METHOD_DISABLED');
  });
});
