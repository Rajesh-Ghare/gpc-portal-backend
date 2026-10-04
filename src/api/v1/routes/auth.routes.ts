import { Router } from 'express';
import * as authController from '../../../controllers/authController';
import { authenticate } from '../../../middleware/auth';
import { requireAuthMethod } from '../../../middleware/authMethod';
import { validateBody } from '../../../middleware/validate';
import {
  googleSignInSchema,
  requestEmailOtpSchema,
  requestOtpSchema,
  updateProfileSchema,
  verifyEmailOtpSchema,
  verifyOtpSchema,
} from '../../../validations/auth.validation';

export const authRouter = Router();

authRouter.get('/methods', authController.methods);

// Mobile OTP — off by default until SMS/DLT is ready (AUTH_METHODS, ADR-040).
authRouter.post('/request-otp', requireAuthMethod('mobile_otp'), validateBody(requestOtpSchema), authController.requestOtp);
authRouter.post('/verify-otp', requireAuthMethod('mobile_otp'), validateBody(verifyOtpSchema), authController.verifyOtp);

authRouter.post(
  '/email/request-otp',
  requireAuthMethod('email_otp'),
  validateBody(requestEmailOtpSchema),
  authController.requestEmailOtp,
);
authRouter.post(
  '/email/verify-otp',
  requireAuthMethod('email_otp'),
  validateBody(verifyEmailOtpSchema),
  authController.verifyEmailOtp,
);

authRouter.post('/google', requireAuthMethod('google'), validateBody(googleSignInSchema), authController.google);

authRouter.get('/me', authenticate, authController.me);
authRouter.patch('/me', authenticate, validateBody(updateProfileSchema), authController.updateMe);
authRouter.post('/logout', authenticate, authController.logout);
