import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailProvider } from './EmailProvider';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Any SMTP server. Currently Gmail with an App Password as a stopgap
 * (smtp.gmail.com:587, ~500 emails/day on a free account, may land in
 * spam) — replace with a transactional provider and a domain with
 * SPF/DKIM before real traffic. Only config changes are needed for any
 * SMTP-speaking provider (Brevo, SES SMTP, Resend SMTP…).
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure, // never fall back to plaintext on 587
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: EmailMessage) {
    const info = await this.transporter.sendMail({ from: this.config.from, ...message });
    return { providerMessageId: info.messageId };
  }
}
