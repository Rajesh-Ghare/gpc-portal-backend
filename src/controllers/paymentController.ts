import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as paymentService from '../services/paymentService';

export async function createPayment(req: Request, res: Response) {
  const payment = await paymentService.createPayment(req.body, req.currentUser!.id);
  sendSuccess(res, payment, 'Payment created', {}, 201);
}

export async function verifyPayment(req: Request, res: Response) {
  const result = await paymentService.verifyCheckoutPayment(req.body, req.currentUser!.id);
  sendSuccess(res, result, 'Payment verified');
}

/** No req.currentUser here — the caller is the payment provider, authenticated by signature, not a session. */
export async function webhook(req: Request, res: Response) {
  const result = await paymentService.processWebhook({ rawBody: req.rawBody, body: req.body, headers: req.headers });
  sendSuccess(res, result);
}

export async function simulatePayment(req: Request, res: Response) {
  const outcome = req.body?.outcome === 'FAILED' ? 'FAILED' : 'PAID';
  const result = await paymentService.simulatePayment(requireParam(req, 'paymentId'), req.currentUser!.id, outcome);
  sendSuccess(res, result, 'Payment simulated');
}
