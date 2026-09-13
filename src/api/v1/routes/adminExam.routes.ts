import { Router } from 'express';
import * as controller from '../../../controllers/adminExamController';
import { authenticate, requirePermission } from '../../../middleware/auth';

export const adminExamRouter = Router();

adminExamRouter.use(authenticate);

// Attempts — admin support/moderation view (see attemptAdminService for why
// this is a separate serializer from the student-facing one).
adminExamRouter.get('/attempts', requirePermission('attempt.view'), controller.listAttempts);
adminExamRouter.get('/attempts/:attemptId', requirePermission('attempt.view'), controller.getAttempt);

// Results
adminExamRouter.get('/tests/:testId/results', requirePermission('result.view'), controller.listResultsForTest);
adminExamRouter.get('/results/:id', requirePermission('result.view'), controller.getResult);
adminExamRouter.post('/tests/:testId/results/release', requirePermission('result.release'), controller.releaseResults);
