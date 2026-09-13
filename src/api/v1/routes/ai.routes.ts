import { Router } from 'express';
import * as controller from '../../../controllers/aiController';
import { authenticate, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import { createAiJobSchema, rejectAiItemSchema } from '../../../validations/ai.validation';

export const aiRouter = Router();

aiRouter.use(authenticate);
aiRouter.use(requirePermission('ai.generate'));

aiRouter.get('/ai/jobs', controller.listJobs);
aiRouter.get('/ai/jobs/:jobId', controller.getJob);
aiRouter.post('/ai/jobs', validateBody(createAiJobSchema), controller.createJob);
aiRouter.post('/ai/jobs/:jobId/items/:itemId/approve', controller.approveItem);
aiRouter.post('/ai/jobs/:jobId/items/:itemId/reject', validateBody(rejectAiItemSchema), controller.rejectItem);
