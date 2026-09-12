import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as testRepo from '../repositories/testRepository';
import { countApprovedQuestions } from '../repositories/questionRepository';
import { getExamOrThrow } from './competitiveExamService';
import { getSeriesOrThrow } from './testSeriesService';
import { recordAudit } from './auditLogService';
import { slugify } from '../utils/slugify';
import type { createTestSchema, updateTestSchema } from '../validations/testBuilder.validation';
import type { AuditContext } from './questionService';
import type { Test } from '../models';

type CreateTestInput = z.infer<typeof createTestSchema>;
type UpdateTestInput = z.infer<typeof updateTestSchema>;

export async function listTests(filter: testRepo.TestFilter = {}) {
  return testRepo.listTests(filter);
}

export async function getTestOrThrow(id: string) {
  const test = await testRepo.findTestById(id);
  if (!test) {
    throw new AppError(ErrorCode.TEST_NOT_FOUND, 'Test not found', 404);
  }
  return test;
}

export async function getTestDetailOrThrow(id: string) {
  const test = await testRepo.findTestWithDetail(id);
  if (!test) {
    throw new AppError(ErrorCode.TEST_NOT_FOUND, 'Test not found', 404);
  }
  return test;
}

/** Only a DRAFT test's structure (sections/questions/rules/basic info) may be edited. */
export function ensureTestEditable(test: Test) {
  if (test.status !== 'DRAFT') {
    throw new AppError(
      ErrorCode.TEST_NOT_EDITABLE,
      `Test cannot be modified while status is ${test.status} — only DRAFT tests are editable`,
      409,
    );
  }
}

async function ensureSlugAvailable(slug: string, excludeId?: string) {
  const existing = await testRepo.findTestBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError(ErrorCode.DUPLICATE_SLUG, `A test with slug "${slug}" already exists`, 409);
  }
}

export async function createTest(input: CreateTestInput, createdBy: string) {
  await getExamOrThrow(input.competitiveExamId);
  if (input.testSeriesId) {
    await getSeriesOrThrow(input.testSeriesId);
  }

  const slug = input.slug ?? slugify(input.title);
  await ensureSlugAvailable(slug);

  return testRepo.createTest({
    competitiveExamId: input.competitiveExamId,
    testSeriesId: input.testSeriesId ?? null,
    title: input.title,
    slug,
    description: input.description ?? null,
    instructions: input.instructions ?? null,
    testType: input.testType ?? 'MOCK',
    durationSeconds: input.durationSeconds,
    passingMarks: input.passingMarks !== undefined ? String(input.passingMarks) : null,
    defaultMarksPerQuestion:
      input.defaultMarksPerQuestion !== undefined ? String(input.defaultMarksPerQuestion) : undefined,
    defaultNegativeMarks: input.defaultNegativeMarks !== undefined ? String(input.defaultNegativeMarks) : undefined,
    selectionMode: input.selectionMode,
    randomizeQuestions: input.randomizeQuestions,
    randomizeOptions: input.randomizeOptions,
    attemptPolicy: input.attemptPolicy,
    resultVisibility: input.resultVisibility,
    showScore: input.showScore,
    showCorrectAnswers: input.showCorrectAnswers,
    showExplanations: input.showExplanations,
    showRank: input.showRank,
    showPercentile: input.showPercentile,
    availableFrom: input.availableFrom ?? null,
    availableUntil: input.availableUntil ?? null,
    requiredLanguages: input.requiredLanguages,
    createdBy,
  });
}

export async function updateTest(id: string, input: UpdateTestInput, updatedBy: string) {
  const test = await getTestOrThrow(id);
  ensureTestEditable(test);

  if (input.competitiveExamId && input.competitiveExamId !== test.competitiveExamId) {
    await getExamOrThrow(input.competitiveExamId);
  }
  if (input.testSeriesId && input.testSeriesId !== test.testSeriesId) {
    await getSeriesOrThrow(input.testSeriesId);
  }

  const nextSlug = input.slug ?? (input.title ? slugify(input.title) : undefined);
  if (nextSlug && nextSlug !== test.slug) {
    await ensureSlugAvailable(nextSlug, id);
  }

  return testRepo.updateTest(test, {
    ...input,
    slug: nextSlug ?? test.slug,
    passingMarks: input.passingMarks !== undefined ? String(input.passingMarks) : test.passingMarks,
    defaultMarksPerQuestion:
      input.defaultMarksPerQuestion !== undefined ? String(input.defaultMarksPerQuestion) : test.defaultMarksPerQuestion,
    defaultNegativeMarks:
      input.defaultNegativeMarks !== undefined ? String(input.defaultNegativeMarks) : test.defaultNegativeMarks,
    updatedBy,
  });
}

export async function deleteTest(id: string) {
  const test = await getTestOrThrow(id);
  ensureTestEditable(test);
  await testRepo.softDeleteTest(test);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  computedTotals: { totalQuestions: number; totalMarks: number };
}

export async function validateTest(id: string): Promise<ValidationResult> {
  const test = await getTestDetailOrThrow(id);
  const errors: string[] = [];
  let totalQuestions = 0;
  let totalMarks = 0;

  if (test.selectionMode === 'MANUAL') {
    const testQuestions = test.testQuestions;
    if (!testQuestions || testQuestions.length === 0) {
      errors.push('Test has no questions assigned (selectionMode is MANUAL)');
    } else {
      totalQuestions = testQuestions.length;
      totalMarks = testQuestions.reduce(
        (sum, tq) => sum + Number(tq.marks ?? test.defaultMarksPerQuestion),
        0,
      );
    }
  } else if (test.selectionMode === 'RULE_BASED') {
    const rules = test.testRules;
    if (!rules || rules.length === 0) {
      errors.push('Test has no selection rules defined (selectionMode is RULE_BASED)');
    } else {
      for (const rule of rules) {
        const available = await countApprovedQuestions({
          subjectId: rule.subjectId,
          topicId: rule.topicId,
          questionType: rule.questionType,
          difficulty: rule.difficulty,
          tagIds: (rule.tags ?? []).map((t) => t.id),
        });
        if (available < rule.questionCount) {
          errors.push(
            `Rule ${rule.id} requires ${rule.questionCount} approved questions but only ${available} are available`,
          );
        }
        totalQuestions += rule.questionCount;
      }
      totalMarks = totalQuestions * Number(test.defaultMarksPerQuestion);
    }
  }

  if (test.durationSeconds <= 0) {
    errors.push('durationSeconds must be greater than 0');
  }

  return { valid: errors.length === 0, errors, computedTotals: { totalQuestions, totalMarks } };
}

export async function publishTest(id: string, actorId: string, context: AuditContext = {}) {
  const test = await getTestOrThrow(id);
  if (test.status !== 'DRAFT') {
    throw new AppError(ErrorCode.TEST_INVALID_STATUS_TRANSITION, 'Only a DRAFT test can be published', 409);
  }

  const result = await validateTest(id);
  if (!result.valid) {
    throw new AppError(ErrorCode.TEST_VALIDATION_FAILED, 'Test failed validation and cannot be published', 422, result.errors);
  }

  const beforeStatus = { status: test.status };
  test.status = 'PUBLISHED';
  test.publishedAt = new Date();
  test.publishedBy = actorId;
  test.totalQuestions = result.computedTotals.totalQuestions;
  test.totalMarks = String(result.computedTotals.totalMarks);
  await test.save();

  await recordAudit({
    actorId,
    action: 'test.publish',
    entityType: 'test',
    entityId: id,
    beforeData: beforeStatus,
    afterData: { status: test.status, totalQuestions: test.totalQuestions, totalMarks: test.totalMarks },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return test;
}

export async function closeTest(id: string, actorId: string, context: AuditContext = {}) {
  const test = await getTestOrThrow(id);
  if (test.status !== 'PUBLISHED') {
    throw new AppError(ErrorCode.TEST_INVALID_STATUS_TRANSITION, 'Only a PUBLISHED test can be closed', 409);
  }

  test.status = 'CLOSED';
  test.closedAt = new Date();
  test.closedBy = actorId;
  await test.save();

  await recordAudit({
    actorId,
    action: 'test.close',
    entityType: 'test',
    entityId: id,
    beforeData: { status: 'PUBLISHED' },
    afterData: { status: 'CLOSED' },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return test;
}

export async function archiveTest(id: string, actorId: string) {
  const test = await getTestOrThrow(id);
  if (test.status !== 'DRAFT' && test.status !== 'CLOSED') {
    throw new AppError(
      ErrorCode.TEST_INVALID_STATUS_TRANSITION,
      'Only a DRAFT or CLOSED test can be archived',
      409,
    );
  }

  test.status = 'ARCHIVED';
  test.updatedBy = actorId;
  await test.save();
  return test;
}
