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
  otpProvider: string;
  paymentProvider: string;
}) {
  if (config.nodeEnv !== 'production') return;

  const offending = [
    config.otpProvider === 'mock' ? 'OTP_PROVIDER' : null,
    config.paymentProvider === 'mock' ? 'PAYMENT_PROVIDER' : null,
  ].filter((name): name is string => name !== null);

  if (offending.length > 0) {
    throw new Error(
      `Refusing to start: ${offending.join(', ')} is set to "mock" (or unset) with NODE_ENV=production. ` +
        'Configure a real provider — mock providers are for local development and tests only.',
    );
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const baseDbName = required('DB_NAME', 'competitive_exam');

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

  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  aiProvider: process.env.AI_PROVIDER || 'mock',

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
} as const;

assertNoMockProvidersInProduction({
  nodeEnv: env.nodeEnv,
  otpProvider: env.otp.provider,
  paymentProvider: env.paymentProvider,
});
