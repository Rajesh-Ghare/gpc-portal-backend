import type { z } from 'zod';
import { sequelize, Question, QuestionOption, QuestionOptionTranslation, QuestionTranslation, QuestionVersion } from '../models';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as questionRepo from '../repositories/questionRepository';
import { findOrCreateTagByName } from '../repositories/tagRepository';
import { getSubjectOrThrow } from './subjectService';
import { getTopicOrThrow } from './topicService';
import { recordAudit } from './auditLogService';
import type {
  createQuestionSchema,
  createQuestionVersionSchema,
  updateQuestionMetadataSchema,
} from '../validations/question.validation';

type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
type CreateVersionInput = z.infer<typeof createQuestionVersionSchema>;
type UpdateMetadataInput = z.infer<typeof updateQuestionMetadataSchema>;

export interface AuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function listQuestions(filter: questionRepo.QuestionFilter = {}) {
  return questionRepo.listQuestions(filter);
}

export async function getQuestionOrThrow(id: string) {
  const question = await questionRepo.findQuestionById(id);
  if (!question) {
    throw new AppError(ErrorCode.QUESTION_NOT_FOUND, 'Question not found', 404);
  }
  return question;
}

export async function getQuestionDetailOrThrow(id: string) {
  const detail = await questionRepo.findQuestionDetail(id);
  if (!detail) {
    throw new AppError(ErrorCode.QUESTION_NOT_FOUND, 'Question not found', 404);
  }
  return detail;
}

/**
 * V1 focuses on MCQ_SINGLE (spec section 42). Other question types are not
 * yet strictly validated here — this is the one place that would need to
 * grow when MCQ_MULTI/TRUE_FALSE/etc. evaluation strategies are added.
 */
function validateOptionsForType(questionType: string, options: CreateVersionInput['options']) {
  if (questionType !== 'MCQ_SINGLE') {
    return;
  }
  if (options.length < 2) {
    throw new AppError(ErrorCode.QUESTION_VERSION_INVALID, 'MCQ_SINGLE questions need at least 2 options', 422);
  }
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) {
    throw new AppError(
      ErrorCode.QUESTION_VERSION_INVALID,
      'MCQ_SINGLE questions must have exactly one correct option',
      422,
    );
  }
}

async function createVersionRows(
  questionId: string,
  versionNumber: number,
  content: CreateVersionInput,
  createdBy: string,
  transaction: import('sequelize').Transaction,
) {
  const version = await QuestionVersion.create(
    {
      questionId,
      versionNumber,
      explanation: content.explanation ?? null,
      solutionSteps: content.solutionSteps ?? null,
      marks: content.marks !== undefined ? String(content.marks) : null,
      negativeMarks: content.negativeMarks !== undefined ? String(content.negativeMarks) : null,
      createdBy,
    },
    { transaction },
  );

  await QuestionTranslation.bulkCreate(
    content.translations.map((t) => ({
      questionVersionId: version.id,
      languageCode: t.languageCode,
      questionText: t.questionText,
      explanation: t.explanation ?? null,
      solutionSteps: t.solutionSteps ?? null,
    })),
    { transaction },
  );

  for (const [index, opt] of content.options.entries()) {
    const option = await QuestionOption.create(
      {
        questionVersionId: version.id,
        optionKey: opt.optionKey,
        displayOrder: index + 1,
        isCorrect: opt.isCorrect ?? false,
        numericValue: opt.numericValue !== undefined ? String(opt.numericValue) : null,
      },
      { transaction },
    );

    await QuestionOptionTranslation.bulkCreate(
      opt.translations.map((t) => ({
        questionOptionId: option.id,
        languageCode: t.languageCode,
        optionText: t.optionText,
      })),
      { transaction },
    );
  }

  return version;
}

export async function createQuestion(input: CreateQuestionInput, createdBy: string) {
  await getSubjectOrThrow(input.subjectId);
  if (input.topicId) {
    const topic = await getTopicOrThrow(input.topicId);
    if (topic.subjectId !== input.subjectId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'topicId must belong to subjectId', 422);
    }
  }

  const questionType = input.questionType ?? 'MCQ_SINGLE';
  validateOptionsForType(questionType, input.options);

  return sequelize.transaction(async (transaction) => {
    const question = await Question.create(
      {
        subjectId: input.subjectId,
        topicId: input.topicId ?? null,
        questionType,
        difficulty: input.difficulty ?? 'MEDIUM',
        defaultLanguageCode: input.defaultLanguageCode ?? 'en',
        createdBy,
      },
      { transaction },
    );

    await createVersionRows(question.id, 1, input, createdBy, transaction);

    if (input.tags && input.tags.length > 0) {
      const tags = await Promise.all(input.tags.map((name) => findOrCreateTagByName(name, transaction)));
      await question.setTags(tags, { transaction });
    }

    return question;
  }).then((question) => getQuestionDetailOrThrow(question.id));
}

export async function createQuestionVersion(
  id: string,
  input: CreateVersionInput,
  actorId: string,
  context: AuditContext = {},
) {
  const question = await getQuestionOrThrow(id);
  validateOptionsForType(question.questionType, input.options);

  const latest = await questionRepo.findLatestVersion(id);
  const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

  await sequelize.transaction(async (transaction) => {
    await createVersionRows(id, nextVersionNumber, input, actorId, transaction);
    question.version = nextVersionNumber;
    question.updatedBy = actorId;
    await question.save({ transaction });
  });

  await recordAudit({
    actorId,
    action: 'question.version_created',
    entityType: 'question',
    entityId: id,
    afterData: { versionNumber: nextVersionNumber },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return getQuestionDetailOrThrow(id);
}

export async function updateQuestionMetadata(id: string, input: UpdateMetadataInput, actorId: string) {
  const question = await getQuestionOrThrow(id);
  const nextSubjectId = input.subjectId ?? question.subjectId;

  if (input.subjectId && input.subjectId !== question.subjectId) {
    await getSubjectOrThrow(input.subjectId);
  }
  if (input.topicId) {
    const topic = await getTopicOrThrow(input.topicId);
    if (topic.subjectId !== nextSubjectId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'topicId must belong to subjectId', 422);
    }
  }

  question.set({
    subjectId: nextSubjectId,
    topicId: input.topicId === undefined ? question.topicId : input.topicId,
    questionType: input.questionType ?? question.questionType,
    difficulty: input.difficulty ?? question.difficulty,
    updatedBy: actorId,
  });
  await question.save();

  if (input.tags) {
    const tags = await sequelize.transaction((transaction) =>
      Promise.all(input.tags!.map((name) => findOrCreateTagByName(name, transaction))),
    );
    await question.setTags(tags);
  }

  return getQuestionDetailOrThrow(id);
}

export async function approveQuestion(id: string, actorId: string, context: AuditContext = {}) {
  const question = await getQuestionOrThrow(id);
  const beforeStatus = { reviewStatus: question.reviewStatus, status: question.status };

  question.reviewStatus = 'APPROVED';
  question.status = 'PUBLISHED';
  question.reviewedBy = actorId;
  question.reviewedAt = new Date();
  await question.save();

  await recordAudit({
    actorId,
    action: 'question.approve',
    entityType: 'question',
    entityId: id,
    beforeData: beforeStatus,
    afterData: { reviewStatus: question.reviewStatus, status: question.status },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return question;
}

export async function rejectQuestion(id: string, actorId: string, reason?: string, context: AuditContext = {}) {
  const question = await getQuestionOrThrow(id);
  const beforeStatus = { reviewStatus: question.reviewStatus };

  question.reviewStatus = 'REJECTED';
  question.reviewedBy = actorId;
  question.reviewedAt = new Date();
  await question.save();

  await recordAudit({
    actorId,
    action: 'question.reject',
    entityType: 'question',
    entityId: id,
    beforeData: beforeStatus,
    afterData: { reviewStatus: question.reviewStatus, reason: reason ?? null },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return question;
}

export async function deleteQuestion(id: string) {
  const question = await getQuestionOrThrow(id);
  await question.destroy();
}
