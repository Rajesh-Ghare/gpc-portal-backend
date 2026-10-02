import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildDbSslOptions } from '../../src/config/dbSsl';

const dir = mkdtempSync(join(tmpdir(), 'dbssl-'));
const caPath = join(dir, 'ca.pem');
writeFileSync(caPath, 'TEST-CA-CONTENTS');

describe('buildDbSslOptions', () => {
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('adds no TLS options when DB_SSL is off', () => {
    expect(buildDbSslOptions({ enabled: false, caPath: null, allowUnverified: false })).toEqual({});
  });

  it('verifies the certificate by default (public CA store)', () => {
    expect(buildDbSslOptions({ enabled: true, caPath: null, allowUnverified: false })).toEqual({
      ssl: { require: true, rejectUnauthorized: true },
    });
  });

  it('verifies against the provider CA bundle when DB_SSL_CA_PATH is set', () => {
    const options = buildDbSslOptions({ enabled: true, caPath, allowUnverified: false }) as {
      ssl: { rejectUnauthorized: boolean; ca: Buffer };
    };
    expect(options.ssl.rejectUnauthorized).toBe(true);
    expect(options.ssl.ca.toString()).toBe('TEST-CA-CONTENTS');
  });

  it('fails fast with a clear message when the CA file is missing', () => {
    expect(() =>
      buildDbSslOptions({ enabled: true, caPath: join(dir, 'missing.pem'), allowUnverified: false }),
    ).toThrow(/DB_SSL_CA_PATH/);
  });

  it('skips verification only when explicitly allowed', () => {
    expect(buildDbSslOptions({ enabled: true, caPath: null, allowUnverified: true })).toEqual({
      ssl: { require: true, rejectUnauthorized: false },
    });
  });
});
