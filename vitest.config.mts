import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      // OTP rate limits off by default: every suite logs in as the same
      // seeded users from 127.0.0.1, and otp_requests rows persist across
      // runs. tests/integration/otpRateLimit.test.ts turns them back on
      // (vi.hoisted) with its own numbers and IPs.
      OTP_RESEND_COOLDOWN_SECONDS: '0',
      OTP_MAX_SENDS_PER_NUMBER_PER_HOUR: '0',
      OTP_MAX_SENDS_PER_IP_PER_HOUR: '0',
      OTP_MAX_VERIFY_ATTEMPTS_PER_NUMBER_PER_HOUR: '0',
      // A developer's .env may select Razorpay for manual testing; the suite
      // must never call it. tests/integration/razorpay.test.ts opts in with
      // fake keys and a stubbed API client.
      PAYMENT_PROVIDER: 'mock',
    },
    // Never collect compiled copies of the tests if `tsc` ever emits into dist/.
    exclude: ['**/node_modules/**', 'dist/**'],
    testTimeout: 15000,
    // Integration tests share one real Postgres database and log in as the
    // same seeded users (e.g. SUPER_ADMIN) — running test files in parallel
    // lets one file's OTP request race another's "find the latest active
    // OTP request" lookup. Sequential execution avoids that; this suite is
    // small enough that it costs little.
    fileParallelism: false,
  },
});
