/**
 * Plain-JS config consumed by sequelize-cli directly (the CLI does not run
 * through our TypeScript build). Application code should use
 * `src/config/env.ts` instead — this file exists only for `sequelize-cli`.
 */
require('dotenv').config();
const { readFileSync } = require('fs');

// Mirrors buildDbSslOptions() in src/config/dbSsl.ts — keep in sync.
// Verifies the database certificate unless DB_SSL_ALLOW_UNVERIFIED=true.
function sslDialectOptions() {
  if (process.env.DB_SSL !== 'true') return {};
  if (process.env.DB_SSL_ALLOW_UNVERIFIED === 'true') {
    return { ssl: { require: true, rejectUnauthorized: false } };
  }
  const caPath = process.env.DB_SSL_CA_PATH;
  return {
    ssl: { require: true, rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath) } : {}) },
  };
}

const common = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME || 'competitive_exam',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: common,
  test: {
    ...common,
    database: `${common.database}_test`,
  },
  production: {
    ...common,
    dialectOptions: sslDialectOptions(),
  },
};
