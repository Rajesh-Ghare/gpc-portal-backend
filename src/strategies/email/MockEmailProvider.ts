import type { EmailMessage, EmailProvider } from './EmailProvider';

/**
 * Development/test-only. Never sends anything — logs the message to the
 * console and keeps the last one per recipient so tests can read the OTP.
 * Production refuses to start with it while email login is enabled
 * (ADR-034/040).
 */
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  private lastByRecipient = new Map<string, EmailMessage>();

  async send(message: EmailMessage) {
    this.lastByRecipient.set(message.to, message);
    console.log(`[MockEmailProvider] To ${message.to}: ${message.subject}\n${message.text}`);
    return { providerMessageId: `mock-${Date.now()}` };
  }

  /** Test/dev-only introspection. */
  getLastMessage(to: string): EmailMessage | undefined {
    return this.lastByRecipient.get(to);
  }

  /** Test/dev-only: the 6-digit code from the last OTP email to `to`. */
  getLastSentOtp(to: string): string | undefined {
    return this.getLastMessage(to)?.text.match(/\b(\d{6})\b/)?.[1];
  }
}

export const mockEmailProvider = new MockEmailProvider();
