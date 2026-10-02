import { describe, expect, it } from 'vitest';
import { assertNoMockProvidersInProduction, parseNonNegativeInt, parseTrustProxy } from '../../src/config/env';

describe('parseTrustProxy', () => {
  it('defaults to not trusting any proxy', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('accepts a hop count or proxy addresses', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });

  it('refuses `true`, which would let clients spoof their IP', () => {
    expect(() => parseTrustProxy('true')).toThrow(/X-Forwarded-For/);
  });
});

describe('parseNonNegativeInt', () => {
  it('uses the fallback only when unset', () => {
    expect(parseNonNegativeInt('X', undefined, 60)).toBe(60);
    expect(parseNonNegativeInt('X', '', 60)).toBe(60);
    expect(parseNonNegativeInt('X', '0', 60)).toBe(0);
    expect(parseNonNegativeInt('X', '15', 60)).toBe(15);
  });

  it('fails fast on a malformed value instead of silently using the default', () => {
    expect(() => parseNonNegativeInt('OTP_X', '5m', 60)).toThrow(/OTP_X/);
    expect(() => parseNonNegativeInt('OTP_X', '-1', 60)).toThrow(/OTP_X/);
  });
});

describe('assertNoMockProvidersInProduction', () => {
  it('allows mock providers outside production', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(() =>
        assertNoMockProvidersInProduction({ nodeEnv, otpProvider: 'mock', paymentProvider: 'mock' }),
      ).not.toThrow();
    }
  });

  it('refuses a mock payment provider in production', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', otpProvider: 'msg91', paymentProvider: 'mock' }),
    ).toThrow(/PAYMENT_PROVIDER/);
  });

  it('refuses a mock OTP provider in production', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', otpProvider: 'mock', paymentProvider: 'razorpay' }),
    ).toThrow(/OTP_PROVIDER/);
  });

  it('names every offending provider at once', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', otpProvider: 'mock', paymentProvider: 'mock' }),
    ).toThrow(/OTP_PROVIDER, PAYMENT_PROVIDER/);
  });

  it('allows real providers in production', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', otpProvider: 'msg91', paymentProvider: 'razorpay' }),
    ).not.toThrow();
  });
});
