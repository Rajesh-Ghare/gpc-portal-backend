import { Router } from 'express';
import * as testBrowseController from '../../../controllers/testBrowseController';
import * as attemptController from '../../../controllers/attemptController';
import * as productBrowseController from '../../../controllers/productBrowseController';
import * as orderController from '../../../controllers/orderController';
import { authenticate } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import { saveAnswerSchema } from '../../../validations/attempt.validation';
import { createOrderSchema } from '../../../validations/order.validation';

export const studentRouter = Router();

// Per spec section 2's flow, login happens before browsing — every route
// here requires authentication (no admin permission needed, just a valid
// session; attempt ownership is checked per-attempt via attemptPolicy).
studentRouter.use(authenticate);

studentRouter.get('/tests', testBrowseController.listPublishedTests);
studentRouter.get('/tests/:testId', testBrowseController.getPublishedTest);

studentRouter.get('/products', productBrowseController.listProducts);
studentRouter.get('/products/:productId', productBrowseController.getProduct);

studentRouter.post('/orders', validateBody(createOrderSchema), orderController.createOrder);
studentRouter.get('/orders', orderController.listMyOrders);
studentRouter.get('/orders/:orderId', orderController.getMyOrder);

studentRouter.post('/tests/:testId/attempts', attemptController.createAttempt);
studentRouter.get('/attempts/:attemptId', attemptController.getAttempt);
studentRouter.put(
  '/attempts/:attemptId/questions/:attemptQuestionId/answer',
  validateBody(saveAnswerSchema),
  attemptController.saveAnswer,
);
studentRouter.post('/attempts/:attemptId/submit', attemptController.submitAttempt);
studentRouter.get('/attempts/:attemptId/result', attemptController.getResult);
