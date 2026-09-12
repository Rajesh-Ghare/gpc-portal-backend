import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
  },

  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  otp: {
    provider: process.env.OTP_PROVIDER || 'mock',
    expirySeconds: Number(process.env.OTP_EXPIRY_SECONDS) || 300,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
  },

  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  aiProvider: process.env.AI_PROVIDER || 'mock',

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
} as const;
