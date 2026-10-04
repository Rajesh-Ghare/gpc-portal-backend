import { env } from '../../config/env';
import type { EmailProvider } from './EmailProvider';
import { mockEmailProvider } from './MockEmailProvider';
import { SmtpEmailProvider } from './SmtpEmailProvider';

let smtpProvider: SmtpEmailProvider | null = null;

/** The only place that knows email provider names (validated at startup in src/config/env.ts). */
export function getEmailProvider(): EmailProvider {
  switch (env.email.provider) {
    case 'mock':
      return mockEmailProvider;
    case 'smtp':
      smtpProvider ??= new SmtpEmailProvider({ ...env.email.smtp, from: env.email.from });
      return smtpProvider;
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${env.email.provider}`);
  }
}
