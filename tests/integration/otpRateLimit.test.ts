import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runs before the imports below load src/config/env.ts — re-enables the
// limits vitest.config.mts disables for every other suite, and trusts one
// proxy hop so each test can pick its client IP via X-Forwarded-For
// (isolating it from rows other suites create as 127.0.0.1).
vi.hoisted(() => {
  process.env.OTP_RESEND_COOLDOWN_SECONDS = '30';
  process.env.OTP_MAX_SENDS_PER_NUMBER_PER_HOUR = '3';
  process.env.OTP_MAX_SENDS_PER_IP_PER_HOUR = '4';
  process.env.OTP_MAX_VERIFY_ATTEMPTS_PER_NUMBER_PER_HOUR = '6';
  process.env.OTP_MAX_ATTEMPTS = '5';
  process.env.TRUST_PROXY = '1';
});

import { Op } from 'sequelize';
import { createApp } from '../../src/app';
import { OtpRequest, User, sequelize } from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

// Reserved test-only ranges: 97000001xx numbers, RFC 5737 TEST-NET-3 IPs.
const MOBILE_COOLDOWN = '9700000101';
const MOBILE_HOURLY = '9700000102';
const MOBILE_VERIFY_CAP = '9700000103';
const MOBILE_PARALLEL = '9700000104';
const MOBILE_REUSE = '9700000105';
const MOBILE_SEND_FAIL = '9700000106';
const IP_NUMBERS = ['9700000111', '9700000112', '9700000113', '9700000114', '9700000115'];
const ALL_NUMBERS = [
  MOBILE_COOLDOWN,
  MOBILE_HOURLY,
  MOBILE_VERIFY_CAP,
  MOBILE_PARALLEL,
  MOBILE_REUSE,
  MOBILE_SEND_FAIL,
  ...IP_NUMBERS,
];
const IP_CAPPED = '203.0.113.200';
const IP_OTHER = '203.0.113.201';
const ALL_IPS = [IP_CAPPED, IP_OTHER];

/**
 * Each number gets its own client IP by default (203.0.113.1xx), so the
 * per-IP cap (4/hour here) only fires in the test that targets it. Rows
 * for these IPs are removed by cleanup() via their mobile numbers.
 */
function ipFor(mobileNumber: string) {
  return `203.0.113.${Number(mobileNumber.slice(-3))}`;
}

function requestOtp(mobileNumber: string, ip = ipFor(mobileNumber)) {
  return request(app).post('/api/v1/auth/request-otp').set('X-Forwarded-For', ip).send({ mobileNumber });
}

function verifyOtp(mobileNumber: string, otp: string) {
  return request(app)
    .post('/api/v1/auth/verify-otp')
    .set('X-Forwarded-For', ipFor(mobileNumber))
    .send({ mobileNumber, otp });
}

function wrongCodeFor(otp: string) {
  return otp === '111111' ? '222222' : '111111';
}

/** Simulates time passing without sleeping: shifts this number's OTP rows into the past. */
async function backdate(mobileNumber: string, minutes: number) {
  await sequelize.query(
    `UPDATE otp_requests SET created_at = created_at - make_interval(mins => :minutes) WHERE mobile_number = :mobileNumber`,
    { replacements: { minutes, mobileNumber } },
  );
}

async function cleanup() {
  await OtpRequest.destroy({
    where: { [Op.or]: [{ mobileNumber: ALL_NUMBERS }, { requestIp: ALL_IPS }] },
  });
  await User.destroy({ where: { mobileNumber: ALL_NUMBERS }, force: true });
}

describe('OTP rate limiting', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await sequelize.close();
  });

  it('enforces a resend cooldown per number, with Retry-After', async () => {
    const first = await requestOtp(MOBILE_COOLDOWN).expect(200);
    const resendAt = new Date(first.body.data.resendAvailableAt).getTime();
    expect(resendAt - Date.now()).toBeGreaterThan(25_000);
    expect(resendAt - Date.now()).toBeLessThanOrEqual(30_000);

    const second = await requestOtp(MOBILE_COOLDOWN);
    expect(second.status).toBe(429);
    expect(second.body.errorCode).toBe('RATE_LIMITED');
    const retryAfter = Number(second.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(30);
    expect(second.body.errors[0].retryAfterSeconds).toBe(retryAfter);

    // Once the cooldown has passed, a resend is allowed again.
    await backdate(MOBILE_COOLDOWN, 1);
    await requestOtp(MOBILE_COOLDOWN).expect(200);
  });

  it('caps sends per number per hour, independent of the cooldown', async () => {
    for (let i = 0; i < 3; i += 1) {
      await requestOtp(MOBILE_HOURLY, IP_OTHER).expect(200);
      await backdate(MOBILE_HOURLY, 10); // past the 30s cooldown, still inside the hour
    }

    const capped = await requestOtp(MOBILE_HOURLY, IP_OTHER);
    expect(capped.status).toBe(429);
    expect(capped.body.message).toMatch(/this number/i);
    // Oldest of the 3 rows is now 30 min old → ~30 min until it ages out.
    const retryAfter = Number(capped.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(25 * 60);
    expect(retryAfter).toBeLessThanOrEqual(30 * 60 + 5);
  });

  it('caps sends per client IP across different numbers, keyed on the proxied IP', async () => {
    for (const mobileNumber of IP_NUMBERS.slice(0, 4)) {
      await requestOtp(mobileNumber, IP_CAPPED).expect(200);
    }

    const capped = await requestOtp(IP_NUMBERS[4]!, IP_CAPPED);
    expect(capped.status).toBe(429);
    expect(capped.body.message).toMatch(/this network/i);

    // Same number from a different client IP is unaffected.
    await requestOtp(IP_NUMBERS[4]!, IP_OTHER).expect(200);
  });

  it('caps verify attempts per number across OTPs, so a fresh OTP does not reset guessing', async () => {
    await requestOtp(MOBILE_VERIFY_CAP).expect(200);
    const firstOtp = mockOtpProvider.getLastSentOtp(MOBILE_VERIFY_CAP)!;
    for (let i = 0; i < 5; i += 1) {
      const res = await verifyOtp(MOBILE_VERIFY_CAP, wrongCodeFor(firstOtp));
      expect(res.body.errorCode).toBe('AUTH_OTP_INVALID');
    }

    // Per-OTP cap reached; request a new code (after the cooldown).
    await backdate(MOBILE_VERIFY_CAP, 1);
    await requestOtp(MOBILE_VERIFY_CAP).expect(200);
    const secondOtp = mockOtpProvider.getLastSentOtp(MOBILE_VERIFY_CAP)!;

    // 6th attempt this hour: allowed (and wrong).
    expect((await verifyOtp(MOBILE_VERIFY_CAP, wrongCodeFor(secondOtp))).body.errorCode).toBe('AUTH_OTP_INVALID');

    // 7th: rejected by the per-number cap — even with the correct code.
    const capped = await verifyOtp(MOBILE_VERIFY_CAP, secondOtp);
    expect(capped.status).toBe(429);
    expect(capped.body.errorCode).toBe('RATE_LIMITED');
    expect(Number(capped.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('never counts more than OTP_MAX_ATTEMPTS guesses, even when sent in parallel', async () => {
    await requestOtp(MOBILE_PARALLEL).expect(200);
    const otp = mockOtpProvider.getLastSentOtp(MOBILE_PARALLEL)!;

    const responses = await Promise.all(
      Array.from({ length: 12 }, () => verifyOtp(MOBILE_PARALLEL, wrongCodeFor(otp))),
    );
    expect(responses.every((r) => r.status === 400 || r.status === 429)).toBe(true);
    expect(responses.filter((r) => r.body.message === 'Incorrect OTP.')).toHaveLength(5);

    const row = await OtpRequest.findOne({ where: { mobileNumber: MOBILE_PARALLEL } });
    expect(row!.attemptCount).toBe(5);

    // The correct code is now locked out too.
    expect((await verifyOtp(MOBILE_PARALLEL, otp)).status).toBe(400);
  });

  it('accepts a correct OTP only once, even for parallel requests', async () => {
    await requestOtp(MOBILE_REUSE).expect(200);
    const otp = mockOtpProvider.getLastSentOtp(MOBILE_REUSE)!;

    const responses = await Promise.all([verifyOtp(MOBILE_REUSE, otp), verifyOtp(MOBILE_REUSE, otp)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it('expires the OTP row when the provider fails to send, and still counts it', async () => {
    const spy = vi.spyOn(mockOtpProvider, 'send').mockRejectedValueOnce(new Error('SMS gateway down'));
    const res = await requestOtp(MOBILE_SEND_FAIL);
    spy.mockRestore();
    expect(res.status).toBe(500);

    const row = await OtpRequest.findOne({ where: { mobileNumber: MOBILE_SEND_FAIL } });
    expect(row!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());

    // Counted toward the cooldown, so a failing provider can't be hammered.
    expect((await requestOtp(MOBILE_SEND_FAIL)).status).toBe(429);
  });
});
