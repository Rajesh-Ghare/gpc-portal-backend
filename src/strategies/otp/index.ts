import { env } from '../../config/env';
import type { OtpProvider } from './OtpProvider';
import { mockOtpProvider } from './MockOtpProvider';

/**
 * Provider selection is the only place allowed to know about the `mock`
 * provider name — business logic depends only on the OtpProvider interface
 * (see docs/DECISIONS.md ADR-006).
 */
export function getOtpProvider(): OtpProvider {
  switch (env.otp.provider) {
    case 'mock':
      return mockOtpProvider;
    default:
      throw new Error(`Unknown OTP_PROVIDER: ${env.otp.provider}`);
  }
}
