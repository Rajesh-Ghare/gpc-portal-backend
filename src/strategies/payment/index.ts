import { env } from '../../config/env';
import type { PaymentGateway } from './PaymentGateway';
import { mockPaymentGateway } from './MockPaymentGateway';
import { RazorpayPaymentGateway } from './RazorpayPaymentGateway';

let razorpayGateway: RazorpayPaymentGateway | null = null;

/**
 * Provider selection is the only place allowed to know about provider
 * names — business logic depends only on the PaymentGateway interface (see
 * docs/DECISIONS.md ADR-006). Required credentials are validated at startup
 * in src/config/env.ts, so construction here can't fail on missing config.
 */
export function getPaymentGateway(): PaymentGateway {
  switch (env.paymentProvider) {
    case 'mock':
      return mockPaymentGateway;
    case 'razorpay':
      razorpayGateway ??= new RazorpayPaymentGateway(env.razorpay);
      return razorpayGateway;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${env.paymentProvider}`);
  }
}
