import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as testQuestionRepo from '../repositories/testQuestionRepository';
import * as questionRepo from '../repositories/questionRepository';
import { ensureTestEditable, getTestOrThrow } from './testService';
import { getSectionOrThrow } from './testSectionService';
import type { addTestQuestionSchema } from '../validations/testBuilder.validation';

type AddTestQuestionInput = z.infer<typeof addTestQuestionSchema>;

export async function listTestQuestions(testId: string) {
  await getTestOrThrow(testId);
  return testQuestionRepo.listTestQuestions(testId);
}

export async function addTestQuestion(testId: string, input: AddTestQuestionInput) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);

  const question = await questionRepo.findQuestionById(input.questionId);
  if (!question) {
    throw new AppError(ErrorCode.QUESTION_NOT_FOUND, 'Question not found', 404);
  }
  if (question.reviewStatus !== 'APPROVED') {
    throw new AppError(
      ErrorCode.QUESTION_NOT_APPROVED,
      'Only approved questions can be added to a test',
      422,
    );
  }

  const latestVersion = await questionRepo.findLatestVersion(question.id);
  if (!latestVersion) {
    throw new AppError(ErrorCode.QUESTION_VERSION_INVALID, 'Question has no versions', 422);
  }
  const questionVersionId = input.questionVersionId ?? latestVersion.id;

  if (input.sectionId) {
    const section = await getSectionOrThrow(input.sectionId);
    if (section.testId !== testId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'sectionId must belong to this test', 422);
    }
  }

  const existing = await testQuestionRepo.listTestQuestions(testId);
  if (existing.some((tq) => tq.questionId === input.questionId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'This question is already part of the test', 409);
  }

  const displayOrder = input.displayOrder ?? (await testQuestionRepo.findMaxDisplayOrder(testId)) + 1;
  const marks = input.marks !== undefined ? String(input.marks) : (latestVersion.marks ?? test.defaultMarksPerQuestion);
  const negativeMarks =
    input.negativeMarks !== undefined
      ? String(input.negativeMarks)
      : (latestVersion.negativeMarks ?? test.defaultNegativeMarks);

  return testQuestionRepo.createTestQuestion({
    testId,
    sectionId: input.sectionId ?? null,
    questionId: input.questionId,
    questionVersionId,
    displayOrder,
    marks,
    negativeMarks,
  });
}

export async function removeTestQuestion(testId: string, id: string) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);

  const testQuestion = await testQuestionRepo.findTestQuestionById(id);
  if (!testQuestion || testQuestion.testId !== testId) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Test question not found', 404);
  }
  await testQuestionRepo.deleteTestQuestion(testQuestion);
}
