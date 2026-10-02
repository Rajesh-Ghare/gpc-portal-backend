import type { Transaction } from 'sequelize';
import { sequelize } from '../models';

/**
 * Postgres transaction-scoped advisory lock: serializes work on `key` across
 * every app instance until the transaction ends. Keys are hashed into the
 * int4 lock space; a collision only causes extra serialization, never
 * incorrect results. Prefix keys by domain (`otp:...`, `attempt:...`).
 */
export async function acquireTransactionLock(key: string, transaction: Transaction) {
  await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
    replacements: { key },
    transaction,
  });
}
