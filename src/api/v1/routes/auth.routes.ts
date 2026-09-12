import { Router } from 'express';
import * as authController from '../../../controllers/authController';
import { authenticate } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import { requestOtpSchema, verifyOtpSchema } from '../../../validations/auth.validation';

export const authRouter = Router();

authRouter.post('/request-otp', validateBody(requestOtpSchema), authController.requestOtp);
authRouter.post('/verify-otp', validateBody(verifyOtpSchema), authController.verifyOtp);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/logout', authenticate, authController.logout);
