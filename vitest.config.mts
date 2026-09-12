import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
    },
    testTimeout: 15000,
    // Integration tests share one real Postgres database and log in as the
    // same seeded users (e.g. SUPER_ADMIN) — running test files in parallel
    // lets one file's OTP request race another's "find the latest active
    // OTP request" lookup. Sequential execution avoids that; this suite is
    // small enough that it costs little.
    fileParallelism: false,
  },
});
