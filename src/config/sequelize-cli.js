/**
 * Plain-JS config consumed by sequelize-cli directly (the CLI does not run
 * through our TypeScript build). Application code should use
 * `src/config/env.ts` instead — this file exists only for `sequelize-cli`.
 */
require('dotenv').config();

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
    dialectOptions:
      process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  },
};
