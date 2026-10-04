export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Provider-agnostic transactional email (ADR-006 pattern). Business logic
 * depends only on this; ./index.ts is the only place that knows provider
 * names. Swap SMTP for Resend/SES/etc. by adding a class here.
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ providerMessageId?: string }>;
}
