import { readFileSync } from 'fs';

export interface DbSslConfig {
  enabled: boolean;
  caPath: string | null;
  allowUnverified: boolean;
}

/**
 * pg TLS options for Sequelize's `dialectOptions`. Certificates are verified
 * by default: against Node's built-in CA store (enough for providers using a
 * public CA), or against `DB_SSL_CA_PATH` — the CA bundle your database
 * provider publishes (e.g. AWS RDS `global-bundle.pem`). Nothing here needs
 * a certificate you buy.
 *
 * `DB_SSL_ALLOW_UNVERIFIED=true` keeps encryption but skips verification
 * (vulnerable to man-in-the-middle). It exists only as an explicit,
 * temporary escape hatch; the caller logs a warning when it's on.
 * Mirrored in `sequelize-cli.js` (plain JS for the CLI) — keep in sync.
 */
export function buildDbSslOptions(config: DbSslConfig): Record<string, unknown> {
  if (!config.enabled) return {};

  if (config.allowUnverified) {
    return { ssl: { require: true, rejectUnauthorized: false } };
  }

  let ca: Buffer | undefined;
  if (config.caPath) {
    try {
      ca = readFileSync(config.caPath);
    } catch (err) {
      throw new Error(`DB_SSL_CA_PATH could not be read (${config.caPath}): ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  return { ssl: { require: true, rejectUnauthorized: true, ...(ca ? { ca } : {}) } };
}
