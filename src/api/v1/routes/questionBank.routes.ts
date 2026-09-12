import { Router } from 'express';
import * as controller from '../../../controllers/questionBankController';
import { authenticate, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import {
  createSubjectSchema,
  createTopicSchema,
  updateSubjectSchema,
  updateTopicSchema,
} from '../../../validations/subject.validation';
import {
  createQuestionSchema,
  createQuestionVersionSchema,
  rejectQuestionSchema,
  updateQuestionMetadataSchema,
} from '../../../validations/question.validation';

export const questionBankRouter = Router();

questionBankRouter.use(authenticate);

// Subjects
questionBankRouter.get('/subjects', requirePermission('subject.view'), controller.listSubjects);
questionBankRouter.get('/subjects/:id', requirePermission('subject.view'), controller.getSubject);
questionBankRouter.post(
  '/subjects',
  requirePermission('subject.create'),
  validateBody(createSubjectSchema),
  controller.createSubject,
);
questionBankRouter.put(
  '/subjects/:id',
  requirePermission('subject.update'),
  validateBody(updateSubjectSchema),
  controller.updateSubject,
);
questionBankRouter.delete('/subjects/:id', requirePermission('subject.delete'), controller.deleteSubject);

// Topics (subject.* family covers this nested resource too — see ADR-022)
questionBankRouter.get('/topics', requirePermission('subject.view'), controller.listTopics);
questionBankRouter.get('/topics/:id', requirePermission('subject.view'), controller.getTopic);
questionBankRouter.post(
  '/topics',
  requirePermission('subject.create'),
  validateBody(createTopicSchema),
  controller.createTopic,
);
questionBankRouter.put(
  '/topics/:id',
  requirePermission('subject.update'),
  validateBody(updateTopicSchema),
  controller.updateTopic,
);
questionBankRouter.delete('/topics/:id', requirePermission('subject.delete'), controller.deleteTopic);

// Questions
questionBankRouter.get('/questions', requirePermission('question.view'), controller.listQuestions);
questionBankRouter.get('/questions/:id', requirePermission('question.view'), controller.getQuestion);
questionBankRouter.post(
  '/questions',
  requirePermission('question.create'),
  validateBody(createQuestionSchema),
  controller.createQuestion,
);
questionBankRouter.put(
  '/questions/:id',
  requirePermission('question.update'),
  validateBody(updateQuestionMetadataSchema),
  controller.updateQuestionMetadata,
);
questionBankRouter.post(
  '/questions/:id/versions',
  requirePermission('question.update'),
  validateBody(createQuestionVersionSchema),
  controller.createQuestionVersion,
);
questionBankRouter.post('/questions/:id/approve', requirePermission('question.approve'), controller.approveQuestion);
questionBankRouter.post(
  '/questions/:id/reject',
  requirePermission('question.reject'),
  validateBody(rejectQuestionSchema),
  controller.rejectQuestion,
);
// No dedicated question.delete permission is seeded (spec's example list for
// question.* stops at approve/reject) — gated by question.update instead.
questionBankRouter.delete('/questions/:id', requirePermission('question.update'), controller.deleteQuestion);
