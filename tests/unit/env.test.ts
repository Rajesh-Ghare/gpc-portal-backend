import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertNoMockProvidersInProduction,
  assertPaymentProviderConfig,
  parseAuthMethods,
  parseNonNegativeInt,
  parseTrustProxy,
  resolveAuthMethods,
  type AuthMethod,
} from '../../src/config/env';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assertPaymentProviderConfig', () => {
  const keys = { keyId: 'rzp_live_x', keySecret: 'secret', webhookSecret: 'whsec' };

  it('ignores Razorpay settings when another provider is selected', () => {
    expect(() =>
      assertPaymentProviderConfig({
        nodeEnv: 'production',
        paymentProvider: 'mock',
        razorpay: { keyId: '', keySecret: '', webhookSecret: null },
      }),
    ).not.toThrow();
  });

  it('requires the key id and secret for Razorpay', () => {
    expect(() =>
      assertPaymentProviderConfig({
        nodeEnv: 'development',
        paymentProvider: 'razorpay',
        razorpay: { keyId: '', keySecret: '', webhookSecret: null },
      }),
    ).toThrow(/RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET/);
  });

  it('requires the webhook secret only in production', () => {
    const withoutWebhook = { ...keys, webhookSecret: null };
    expect(() =>
      assertPaymentProviderConfig({ nodeEnv: 'development', paymentProvider: 'razorpay', razorpay: withoutWebhook }),
    ).not.toThrow();
    expect(() =>
      assertPaymentProviderConfig({ nodeEnv: 'production', paymentProvider: 'razorpay', razorpay: withoutWebhook }),
    ).toThrow(/RAZORPAY_WEBHOOK_SECRET/);
  });
});

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
  const allMethods = ['mobile_otp', 'email_otp', 'google'] as const;
  const real = { otpProvider: 'msg91', emailProvider: 'smtp', paymentProvider: 'razorpay' };

  it('allows mock providers outside production', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(() =>
        assertNoMockProvidersInProduction({
          nodeEnv,
          authMethods: allMethods,
          otpProvider: 'mock',
          emailProvider: 'mock',
          paymentProvider: 'mock',
        }),
      ).not.toThrow();
    }
  });

  it('refuses a mock payment provider in production', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', authMethods: allMethods, ...real, paymentProvider: 'mock' }),
    ).toThrow(/PAYMENT_PROVIDER/);
  });

  it('refuses a mock OTP provider in production while mobile login is enabled', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', authMethods: allMethods, ...real, otpProvider: 'mock' }),
    ).toThrow(/OTP_PROVIDER/);
  });

  it('ignores the OTP provider when mobile login is switched off (ADR-040)', () => {
    expect(() =>
      assertNoMockProvidersInProduction({
        nodeEnv: 'production',
        authMethods: ['email_otp', 'google'],
        ...real,
        otpProvider: 'mock',
      }),
    ).not.toThrow();
  });

  it('refuses a mock email provider in production while email login is enabled', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', authMethods: ['email_otp'], ...real, emailProvider: 'mock' }),
    ).toThrow(/EMAIL_PROVIDER/);
  });

  it('names every offending provider at once', () => {
    expect(() =>
      assertNoMockProvidersInProduction({
        nodeEnv: 'production',
        authMethods: allMethods,
        otpProvider: 'mock',
        emailProvider: 'mock',
        paymentProvider: 'mock',
      }),
    ).toThrow(/OTP_PROVIDER, EMAIL_PROVIDER, PAYMENT_PROVIDER/);
  });

  it('allows real providers in production', () => {
    expect(() =>
      assertNoMockProvidersInProduction({ nodeEnv: 'production', authMethods: allMethods, ...real }),
    ).not.toThrow();
  });
});

describe('parseAuthMethods', () => {
  it('defaults to email + Google while SMS is not ready', () => {
    expect(parseAuthMethods(undefined)).toEqual(['email_otp', 'google']);
  });

  it('parses and de-duplicates a list', () => {
    expect(parseAuthMethods('mobile_otp, email_otp,mobile_otp')).toEqual(['mobile_otp', 'email_otp']);
  });

  it('rejects unknown methods', () => {
    expect(() => parseAuthMethods('email_otp,facebook')).toThrow(/facebook/);
  });
});

describe('resolveAuthMethods', () => {
  const base = {
    nodeEnv: 'development',
    authMethods: ['email_otp', 'google'] as AuthMethod[],
    email: { provider: 'mock', from: '', smtp: { host: '', user: '', pass: '' } },
    google: { clientId: 'client-id.apps.googleusercontent.com' },
  };

  it('keeps every configured method', () => {
    expect(resolveAuthMethods(base)).toEqual(['email_otp', 'google']);
  });

  it('drops Google with a warning in development when no client id is set', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveAuthMethods({ ...base, google: { clientId: '' } })).toEqual(['email_otp']);
  });

  it('fails in production when Google is enabled without a client id', () => {
    expect(() => resolveAuthMethods({ ...base, nodeEnv: 'production', google: { clientId: '' } })).toThrow(
      /GOOGLE_CLIENT_ID/,
    );
  });

  it('requires SMTP settings when EMAIL_PROVIDER=smtp', () => {
    expect(() =>
      resolveAuthMethods({ ...base, email: { provider: 'smtp', from: '', smtp: { host: 'smtp.x', user: '', pass: '' } } }),
    ).toThrow(/SMTP_USER, SMTP_PASS, EMAIL_FROM/);
  });

  it('fails if nothing usable is left', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => resolveAuthMethods({ ...base, authMethods: ['google'], google: { clientId: '' } })).toThrow(
      /No sign-in method/,
    );
  });
});
