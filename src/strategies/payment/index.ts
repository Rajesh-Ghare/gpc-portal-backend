import { env } from '../../config/env';
import type { PaymentGateway } from './PaymentGateway';
import { mockPaymentGateway } from './MockPaymentGateway';

/**
 * Provider selection is the only place allowed to know about the `mock`
 * provider name — business logic depends only on the PaymentGateway
 * interface (see docs/DECISIONS.md ADR-006).
 */
export function getPaymentGateway(): PaymentGateway {
  switch (env.paymentProvider) {
    case 'mock':
      return mockPaymentGateway;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${env.paymentProvider}`);
  }
}
