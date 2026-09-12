import { Router } from 'express';
import * as controller from '../../../controllers/testBuilderController';
import { authenticate, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import {
  addTestQuestionSchema,
  createRuleSchema,
  createSectionSchema,
  createTestSchema,
  updateRuleSchema,
  updateSectionSchema,
  updateTestSchema,
} from '../../../validations/testBuilder.validation';

export const testBuilderRouter = Router();

testBuilderRouter.use(authenticate);

// Tests
testBuilderRouter.get('/tests', requirePermission('test.view'), controller.listTests);
testBuilderRouter.get('/tests/:testId', requirePermission('test.view'), controller.getTest);
testBuilderRouter.post('/tests', requirePermission('test.create'), validateBody(createTestSchema), controller.createTest);
testBuilderRouter.put(
  '/tests/:testId',
  requirePermission('test.update'),
  validateBody(updateTestSchema),
  controller.updateTest,
);
testBuilderRouter.delete('/tests/:testId', requirePermission('test.update'), controller.deleteTest);
testBuilderRouter.get('/tests/:testId/validate', requirePermission('test.validate'), controller.validateTest);
testBuilderRouter.post('/tests/:testId/publish', requirePermission('test.publish'), controller.publishTest);
testBuilderRouter.post('/tests/:testId/close', requirePermission('test.close'), controller.closeTest);
// No dedicated test.archive permission is seeded — archive reuses test.close
// (it's a further lifecycle step past close; see ADR-024).
testBuilderRouter.post('/tests/:testId/archive', requirePermission('test.close'), controller.archiveTest);

// Sections
testBuilderRouter.get('/tests/:testId/sections', requirePermission('test.view'), controller.listSections);
testBuilderRouter.post(
  '/tests/:testId/sections',
  requirePermission('test.update'),
  validateBody(createSectionSchema),
  controller.createSection,
);
testBuilderRouter.put(
  '/tests/:testId/sections/:id',
  requirePermission('test.update'),
  validateBody(updateSectionSchema),
  controller.updateSection,
);
testBuilderRouter.delete('/tests/:testId/sections/:id', requirePermission('test.update'), controller.deleteSection);

// Test questions (manual selection)
testBuilderRouter.get('/tests/:testId/questions', requirePermission('test.view'), controller.listTestQuestions);
testBuilderRouter.post(
  '/tests/:testId/questions',
  requirePermission('test.update'),
  validateBody(addTestQuestionSchema),
  controller.addTestQuestion,
);
testBuilderRouter.delete('/tests/:testId/questions/:id', requirePermission('test.update'), controller.removeTestQuestion);

// Test rules (rule-based selection)
testBuilderRouter.get('/tests/:testId/rules', requirePermission('test.view'), controller.listRules);
testBuilderRouter.post(
  '/tests/:testId/rules',
  requirePermission('test.update'),
  validateBody(createRuleSchema),
  controller.createRule,
);
testBuilderRouter.put(
  '/tests/:testId/rules/:id',
  requirePermission('test.update'),
  validateBody(updateRuleSchema),
  controller.updateRule,
);
testBuilderRouter.delete('/tests/:testId/rules/:id', requirePermission('test.update'), controller.deleteRule);
