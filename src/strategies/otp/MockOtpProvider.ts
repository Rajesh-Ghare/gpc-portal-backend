import type { OtpProvider, OtpSendResult } from './OtpProvider';

/**
 * Development/test-only provider. Never sends a real SMS — it logs the OTP
 * to the console (for manual local testing) and keeps the last OTP sent per
 * mobile number in memory so integration tests can retrieve it without
 * needing to intercept an SMS. Never wire this into a production
 * environment (see OTP_PROVIDER in .env.example).
 */
export class MockOtpProvider implements OtpProvider {
  private lastOtpByMobileNumber = new Map<string, string>();

  async send(mobileNumber: string, otp: string): Promise<OtpSendResult> {
    this.lastOtpByMobileNumber.set(mobileNumber, otp);
    console.log(`[MockOtpProvider] OTP for ${mobileNumber}: ${otp}`);
    return { providerRequestId: `mock-${Date.now()}` };
  }

  /** Test/dev-only introspection — not part of the OtpProvider interface. */
  getLastSentOtp(mobileNumber: string): string | undefined {
    return this.lastOtpByMobileNumber.get(mobileNumber);
  }
}

export const mockOtpProvider = new MockOtpProvider();
