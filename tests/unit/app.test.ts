import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('GET /health', () => {
  it('returns a healthy status in the standard response envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok' },
    });
  });
});
