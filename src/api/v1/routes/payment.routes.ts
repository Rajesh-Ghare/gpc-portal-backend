import { Router } from 'express';
import * as controller from '../../../controllers/paymentController';
import { authenticate } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import { createPaymentSchema } from '../../../validations/payment.validation';

export const paymentRouter = Router();

// No authenticate on the webhook route — the caller is the payment
// provider, verified by signature inside paymentService.processWebhook,
// never a logged-in user session. Must stay registered before
// paymentRouter.use(authenticate) below.
paymentRouter.post('/payments/webhook', controller.webhook);

paymentRouter.use(authenticate);

paymentRouter.post('/payments/create', validateBody(createPaymentSchema), controller.createPayment);

// Dev/test-only: simulates the mock provider's webhook callback through the
// real verification path — 404s unless PAYMENT_PROVIDER=mock (see
// paymentService.simulatePayment).
paymentRouter.post('/payments/:paymentId/simulate', controller.simulatePayment);
