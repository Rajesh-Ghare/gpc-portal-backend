import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Unset → fallback; otherwise must be a non-negative integer (0 = disabled), so a typo fails at startup. */
export function parseNonNegativeInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return Number(raw.trim());
}

/**
 * Express `trust proxy` setting. Unset → false (req.ip is the direct peer).
 * Behind a load balancer, set the hop count (e.g. `1`) or the proxy
 * addresses/subnets (e.g. `loopback, 10.0.0.0/8`). `true` is refused: it
 * trusts every X-Forwarded-For entry, letting any client spoof its IP and
 * bypass per-IP rate limits.
 */
export function parseTrustProxy(raw: string | undefined): false | number | string {
  const value = raw?.trim() ?? '';
  if (value === '' || value === 'false') return false;
  if (value === 'true') {
    throw new Error(
      'TRUST_PROXY=true would trust client-supplied X-Forwarded-For headers. ' +
        'Set the number of proxy hops (e.g. 1) or the proxy addresses instead.',
    );
  }
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export const AUTH_METHODS = ['mobile_otp', 'email_otp', 'google'] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

/**
 * AUTH_METHODS: which sign-in methods are live (ADR-040). Defaults to
 * email + Google while SMS (DLT registration) isn't ready; add `mobile_otp`
 * to re-enable mobile login — no code change needed.
 */
export function parseAuthMethods(raw: string | undefined): AuthMethod[] {
  const value = raw?.trim() || 'email_otp,google';
  const methods = [...new Set(value.split(',').map((m) => m.trim()).filter(Boolean))];
  const unknown = methods.filter((m) => !(AUTH_METHODS as readonly string[]).includes(m));
  if (unknown.length > 0) {
    throw new Error(`AUTH_METHODS has unknown method(s): ${unknown.join(', ')}. Allowed: ${AUTH_METHODS.join(', ')}`);
  }
  if (methods.length === 0) throw new Error('AUTH_METHODS must enable at least one sign-in method');
  return methods as AuthMethod[];
}

export interface AuthConfigInput {
  nodeEnv: string;
  authMethods: AuthMethod[];
  email: { provider: string; from: string; smtp: { host: string; user: string; pass: string } };
  google: { clientId: string };
}

/**
 * Validates provider settings for the enabled methods and returns the
 * methods actually available. Google without a client id fails in
 * production; in development it's dropped with a warning, so a fresh
 * checkout still starts while the Google Cloud client is being set up.
 */
export function resolveAuthMethods(config: AuthConfigInput): AuthMethod[] {
  const methods = [...config.authMethods];

  if (methods.includes('email_otp')) {
    if (config.email.provider !== 'mock' && config.email.provider !== 'smtp') {
      throw new Error(`Unknown EMAIL_PROVIDER: ${config.email.provider}`);
    }
    if (config.email.provider === 'smtp') {
      const missing = [
        config.email.smtp.host ? null : 'SMTP_HOST',
        config.email.smtp.user ? null : 'SMTP_USER',
        config.email.smtp.pass ? null : 'SMTP_PASS',
        config.email.from ? null : 'EMAIL_FROM',
      ].filter((name): name is string => name !== null);
      if (missing.length > 0) throw new Error(`EMAIL_PROVIDER=smtp requires: ${missing.join(', ')}`);
    }
  }

  if (methods.includes('google') && !config.google.clientId) {
    if (config.nodeEnv === 'production') {
      throw new Error('AUTH_METHODS includes google but GOOGLE_CLIENT_ID is not set');
    }
    console.warn('[env] GOOGLE_CLIENT_ID not set — "Sign in with Google" is disabled until it is.');
    methods.splice(methods.indexOf('google'), 1);
  }

  if (methods.length === 0) throw new Error('No sign-in method is available — check AUTH_METHODS and its settings');
  return methods;
}

/**
 * Mock OTP/payment providers are a security hole outside local dev/test:
 * MockOtpProvider logs every OTP to stdout, and MockPaymentGateway's webhook
 * secret is hardcoded in source (and `/payments/:id/simulate` is live), so
 * anyone could mark their own order paid. Production must refuse to start
 * with either one rather than silently falling back to it. The mock AI
 * provider is deliberately allowed — its output still requires human
 * approval (ADR-011) and grants nothing on its own. See ADR-034.
 */
export function assertNoMockProvidersInProduction(config: {
  nodeEnv: string;
  authMethods: readonly AuthMethod[];
  otpProvider: string;
  emailProvider: string;
  paymentProvider: string;
}) {
  if (config.nodeEnv !== 'production') return;

  // A provider only matters if the login method that uses it is enabled
  // (ADR-040): with mobile OTP switched off, OTP_PROVIDER=mock is harmless.
  const offending = [
    config.authMethods.includes('mobile_otp') && config.otpProvider === 'mock' ? 'OTP_PROVIDER' : null,
    config.authMethods.includes('email_otp') && config.emailProvider === 'mock' ? 'EMAIL_PROVIDER' : null,
    config.paymentProvider === 'mock' ? 'PAYMENT_PROVIDER' : null,
  ].filter((name): name is string => name !== null);

  if (offending.length > 0) {
    throw new Error(
      `Refusing to start: ${offending.join(', ')} is set to "mock" (or unset) with NODE_ENV=production. ` +
        'Configure a real provider — mock providers are for local development and tests only.',
    );
  }
}

/**
 * Fails startup on missing provider credentials instead of on the first
 * student's payment. The webhook secret is only required in production:
 * locally Razorpay can't reach the webhook anyway (no public URL), and the
 * checkout-verification path works without it.
 */
export function assertPaymentProviderConfig(config: {
  nodeEnv: string;
  paymentProvider: string;
  razorpay: { keyId: string; keySecret: string; webhookSecret: string | null };
}) {
  if (config.paymentProvider !== 'razorpay') return;

  const missing = [
    config.razorpay.keyId ? null : 'RAZORPAY_KEY_ID',
    config.razorpay.keySecret ? null : 'RAZORPAY_KEY_SECRET',
    config.nodeEnv === 'production' && !config.razorpay.webhookSecret ? 'RAZORPAY_WEBHOOK_SECRET' : null,
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new Error(`PAYMENT_PROVIDER=razorpay requires: ${missing.join(', ')}`);
  }

  if (config.nodeEnv === 'production' && config.razorpay.keyId.startsWith('rzp_test_')) {
    console.warn('[env] Razorpay TEST keys in production — no real money will be collected.');
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const baseDbName = required('DB_NAME', 'competitive_exam');

const emailConfig = {
  provider: process.env.EMAIL_PROVIDER || 'mock',
  /** e.g. `GPC Exam Portal <no-reply@example.com>` */
  from: process.env.EMAIL_FROM || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    /** true = implicit TLS (port 465); false = STARTTLS upgrade (587). */
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};
const googleConfig = {
  /** Public OAuth client id (Google Cloud Console → Credentials); no secret is needed to verify ID tokens. */
  clientId: process.env.GOOGLE_CLIENT_ID || '',
};
const authMethods = resolveAuthMethods({
  nodeEnv,
  authMethods: parseAuthMethods(process.env.AUTH_METHODS),
  email: emailConfig,
  google: googleConfig,
});

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  apiBasePath: process.env.API_BASE_PATH || '/api/v1',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT) || 5432,
    // Mirrors src/config/sequelize-cli.js, which appends `_test` for the
    // `test` sequelize-cli environment — keeps the app and the CLI pointed
    // at the same database under NODE_ENV=test.
    name: nodeEnv === 'test' ? `${baseDbName}_test` : baseDbName,
    user: required('DB_USER', 'postgres'),
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    sslCaPath: process.env.DB_SSL_CA_PATH || null,
    sslAllowUnverified: process.env.DB_SSL_ALLOW_UNVERIFIED === 'true',
  },

  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  otp: {
    provider: process.env.OTP_PROVIDER || 'mock',
    expirySeconds: Number(process.env.OTP_EXPIRY_SECONDS) || 300,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
    // Rate limits — see docs/AUTHENTICATION.md "Rate Limiting". 0 disables
    // a limit (the test suite does this; production should never need to).
    resendCooldownSeconds: parseNonNegativeInt(
      'OTP_RESEND_COOLDOWN_SECONDS',
      process.env.OTP_RESEND_COOLDOWN_SECONDS,
      60,
    ),
    maxSendsPerNumberPerHour: parseNonNegativeInt(
      'OTP_MAX_SENDS_PER_NUMBER_PER_HOUR',
      process.env.OTP_MAX_SENDS_PER_NUMBER_PER_HOUR,
      5,
    ),
    maxSendsPerIpPerHour: parseNonNegativeInt(
      'OTP_MAX_SENDS_PER_IP_PER_HOUR',
      process.env.OTP_MAX_SENDS_PER_IP_PER_HOUR,
      50,
    ),
    maxVerifyAttemptsPerNumberPerHour: parseNonNegativeInt(
      'OTP_MAX_VERIFY_ATTEMPTS_PER_NUMBER_PER_HOUR',
      process.env.OTP_MAX_VERIFY_ATTEMPTS_PER_NUMBER_PER_HOUR,
      10,
    ),
  },

  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  /** Sign-in methods actually available (validated; see resolveAuthMethods). */
  authMethods,
  email: emailConfig,
  google: googleConfig,

  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  // Server-side only — the key secret and webhook secret must never be sent
  // to the browser (the key id is public and is, via checkoutOptions()).
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || null,
  },
  aiProvider: process.env.AI_PROVIDER || 'mock',

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
} as const;

assertNoMockProvidersInProduction({
  nodeEnv: env.nodeEnv,
  authMethods: env.authMethods,
  otpProvider: env.otp.provider,
  emailProvider: env.email.provider,
  paymentProvider: env.paymentProvider,
});
assertPaymentProviderConfig(env);
