import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import {
  Attempt,
  AttemptAnswer,
  AttemptQuestion,
  QuestionOption,
  Result,
  ResultDetail,
  sequelize,
} from '../models';
import * as attemptRepo from '../repositories/attemptRepository';
import { incrementAttemptsUsed } from '../repositories/entitlementRepository';
import { ensureOwnsAttempt } from '../policies/attemptPolicy';
import { getPublishedTestOrThrow } from './testBrowseService';
import { findActiveEntitlementForTest } from './entitlementService';
import { getQuestionSelectionStrategy } from '../strategies/questionSelection';
import { getEvaluator } from '../strategies/evaluation';
import { shuffle } from '../utils/shuffle';

export async function getAttemptOrThrow(id: string) {
  const attempt = await attemptRepo.findAttemptById(id);
  if (!attempt) {
    throw new AppError(ErrorCode.ATTEMPT_NOT_FOUND, 'Attempt not found', 404);
  }
  return attempt;
}

export interface CreateAttemptContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createAttempt(testId: string, userId: string, context: CreateAttemptContext = {}) {
  const test = await getPublishedTestOrThrow(testId);

  const existingInProgress = await attemptRepo.findInProgressAttempt(userId, testId);
  if (existingInProgress) {
    return getAttemptDetail(existingInProgress.id, userId);
  }

  const entitlement = await findActiveEntitlementForTest(userId, test);
  if (!entitlement) {
    throw new AppError(ErrorCode.ENTITLEMENT_NOT_FOUND, 'You do not have access to this test', 403);
  }
  if (entitlement.attemptLimit !== null && entitlement.attemptsUsed >= entitlement.attemptLimit) {
    throw new AppError(ErrorCode.ATTEMPT_LIMIT_EXCEEDED, 'You have used all attempts granted for this test', 403);
  }

  const priorAttemptCount = await attemptRepo.countAttemptsForUserTest(userId, testId);
  if (test.attemptPolicy === 'SINGLE' && priorAttemptCount >= 1) {
    throw new AppError(ErrorCode.ATTEMPT_LIMIT_EXCEEDED, 'This test only allows a single attempt', 403);
  }

  const strategy = getQuestionSelectionStrategy(test);
  let selected = await strategy.selectQuestions(test);
  if (test.randomizeQuestions) {
    selected = shuffle(selected);
  }
  if (selected.length === 0) {
    throw new AppError(ErrorCode.TEST_NOT_AVAILABLE, 'This test has no questions available to attempt', 409);
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + test.durationSeconds * 1000);
  const totalMarks = selected.reduce((sum, q) => sum + Number(q.marks), 0);

  const attempt = await sequelize.transaction(async (transaction) => {
    const created = await Attempt.create(
      {
        userId,
        testId,
        attemptNumber: priorAttemptCount + 1,
        status: 'IN_PROGRESS',
        startedAt,
        expiresAt,
        languageCode: test.requiredLanguages[0] ?? 'en',
        totalQuestions: selected.length,
        totalMarks: String(totalMarks),
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
      { transaction },
    );

    await AttemptQuestion.bulkCreate(
      selected.map((q, index) => ({
        attemptId: created.id,
        questionId: q.questionId,
        questionVersionId: q.questionVersionId,
        sectionId: q.sectionId,
        sequenceNumber: index + 1,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      })),
      { transaction },
    );

    await incrementAttemptsUsed(entitlement);

    return created;
  });

  return getAttemptDetail(attempt.id, userId);
}

/** If an IN_PROGRESS attempt's time is up, submit it (auto_submitted=true) before proceeding. */
async function autoSubmitIfExpired(attempt: Attempt): Promise<Attempt> {
  if (attempt.status === 'IN_PROGRESS' && new Date() > attempt.expiresAt) {
    await submitAttempt(attempt.id, attempt.userId);
    return getAttemptOrThrow(attempt.id);
  }
  return attempt;
}

function remainingSeconds(attempt: Attempt): number {
  if (attempt.status !== 'IN_PROGRESS') return 0;
  return Math.max(0, Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000));
}

/** Never includes is_correct/correct_option_id/explanation — see docs/SECURITY.md. */
export async function getAttemptDetail(attemptId: string, userId: string) {
  let attempt = await getAttemptOrThrow(attemptId);
  ensureOwnsAttempt(attempt, userId);
  attempt = await autoSubmitIfExpired(attempt);

  const withQuestions = await attemptRepo.findAttemptWithQuestions(attemptId);
  const attemptQuestions = (withQuestions?.attemptQuestions ?? []).map((aq) => {
    const version = aq.questionVersion;
    const translation =
      version?.translations?.find((t) => t.languageCode === attempt.languageCode) ?? version?.translations?.[0];
    const options = (version?.options ?? []).map((opt) => ({
      id: opt.id,
      optionKey: opt.optionKey,
      displayOrder: opt.displayOrder,
      text: opt.translations?.find((t) => t.languageCode === attempt.languageCode)?.optionText ?? opt.translations?.[0]?.optionText,
    }));

    return {
      id: aq.id,
      sequenceNumber: aq.sequenceNumber,
      sectionId: aq.sectionId,
      marks: aq.marks,
      negativeMarks: aq.negativeMarks,
      markedForReview: aq.markedForReview,
      questionType: aq.question?.questionType ?? 'MCQ_SINGLE',
      questionText: translation?.questionText,
      options,
      answer: aq.answer
        ? {
            selectedOptionId: aq.answer.selectedOptionId,
            answerText: aq.answer.answerText,
            numericAnswer: aq.answer.numericAnswer,
            isMarkedForReview: aq.answer.isMarkedForReview,
          }
        : null,
    };
  });

  return {
    id: attempt.id,
    testId: attempt.testId,
    status: attempt.status,
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    remainingSeconds: remainingSeconds(attempt),
    totalQuestions: attempt.totalQuestions,
    totalMarks: attempt.totalMarks,
    languageCode: attempt.languageCode,
    questions: attemptQuestions,
  };
}

export interface SaveAnswerInput {
  selectedOptionId?: string | null;
  answerText?: string;
  numericAnswer?: number;
  isMarkedForReview?: boolean;
}

export async function saveAnswer(
  attemptId: string,
  attemptQuestionId: string,
  userId: string,
  input: SaveAnswerInput,
) {
  let attempt = await getAttemptOrThrow(attemptId);
  ensureOwnsAttempt(attempt, userId);
  attempt = await autoSubmitIfExpired(attempt);

  if (attempt.status !== 'IN_PROGRESS') {
    throw new AppError(
      attempt.autoSubmitted ? ErrorCode.ATTEMPT_EXPIRED : ErrorCode.ATTEMPT_ALREADY_SUBMITTED,
      attempt.autoSubmitted ? 'Time is up for this attempt' : 'This attempt has already been submitted',
      409,
    );
  }

  const attemptQuestion = await AttemptQuestion.findByPk(attemptQuestionId);
  if (!attemptQuestion || attemptQuestion.attemptId !== attemptId) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Question not found in this attempt', 404);
  }

  if (input.selectedOptionId) {
    const option = await QuestionOption.findByPk(input.selectedOptionId);
    if (!option || option.questionVersionId !== attemptQuestion.questionVersionId) {
      throw new AppError(ErrorCode.INVALID_OPTION, 'Selected option does not belong to this question', 422);
    }
  }

  const now = new Date();
  const hasAnswer = input.selectedOptionId !== undefined || input.answerText !== undefined || input.numericAnswer !== undefined;

  const [answer] = await AttemptAnswer.findOrCreate({
    where: { attemptId, attemptQuestionId },
    defaults: { attemptId, attemptQuestionId },
  });

  if (input.selectedOptionId !== undefined) answer.selectedOptionId = input.selectedOptionId;
  if (input.answerText !== undefined) answer.answerText = input.answerText;
  if (input.numericAnswer !== undefined) answer.numericAnswer = String(input.numericAnswer);
  if (input.isMarkedForReview !== undefined) answer.isMarkedForReview = input.isMarkedForReview;
  answer.lastSavedAt = now;
  if (hasAnswer) answer.answeredAt = now;
  await answer.save();

  if (!attemptQuestion.visitedAt) attemptQuestion.visitedAt = now;
  if (hasAnswer) attemptQuestion.answeredAt = now;
  if (input.isMarkedForReview !== undefined) attemptQuestion.markedForReview = input.isMarkedForReview;
  await attemptQuestion.save();

  return {
    selectedOptionId: answer.selectedOptionId,
    answerText: answer.answerText,
    numericAnswer: answer.numericAnswer,
    isMarkedForReview: answer.isMarkedForReview,
    lastSavedAt: answer.lastSavedAt,
  };
}

export async function submitAttempt(attemptId: string, userId: string) {
  const preCheck = await getAttemptOrThrow(attemptId);
  ensureOwnsAttempt(preCheck, userId);

  if (preCheck.status === 'SUBMITTED') {
    const existing = await Result.findOne({ where: { attemptId } });
    if (existing) return existing;
  }

  return sequelize.transaction(async (transaction) => {
    const attempt = await Attempt.findByPk(attemptId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!attempt) {
      throw new AppError(ErrorCode.ATTEMPT_NOT_FOUND, 'Attempt not found', 404);
    }
    if (attempt.status === 'SUBMITTED') {
      const existing = await Result.findOne({ where: { attemptId }, transaction });
      if (existing) return existing;
    }

    const now = new Date();
    const autoSubmitted = now > attempt.expiresAt;

    const attemptQuestions = await AttemptQuestion.findAll({
      where: { attemptId },
      include: [{ association: 'question' }, { association: 'answer' }],
      transaction,
    });

    let attemptedQuestions = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unansweredQuestions = 0;
    let totalMarks = 0;
    let scoredMarks = 0;
    let negativeMarksTotal = 0;

    const detailRows = [];

    for (const aq of attemptQuestions) {
      totalMarks += Number(aq.marks);
      const evaluator = getEvaluator(aq.question?.questionType ?? 'MCQ_SINGLE');
      const evaluation = await evaluator.evaluate({
        questionVersionId: aq.questionVersionId,
        selectedOptionId: aq.answer?.selectedOptionId ?? null,
        answerText: aq.answer?.answerText ?? null,
        numericAnswer: aq.answer?.numericAnswer ?? null,
        marks: aq.marks,
        negativeMarks: aq.negativeMarks,
      });

      if (evaluation.answerStatus === 'CORRECT') {
        correctAnswers += 1;
        attemptedQuestions += 1;
      } else if (evaluation.answerStatus === 'INCORRECT') {
        incorrectAnswers += 1;
        attemptedQuestions += 1;
      } else {
        unansweredQuestions += 1;
      }
      scoredMarks += Number(evaluation.marksAwarded);
      negativeMarksTotal += Number(evaluation.negativeMarksAwarded);

      detailRows.push({
        resultId: '',
        attemptQuestionId: aq.id,
        questionId: aq.questionId,
        questionVersionId: aq.questionVersionId,
        selectedOptionId: aq.answer?.selectedOptionId ?? null,
        correctOptionId: evaluation.correctOptionId,
        answerStatus: evaluation.answerStatus,
        marksAwarded: evaluation.marksAwarded,
        negativeMarksAwarded: evaluation.negativeMarksAwarded,
        finalMarks: evaluation.finalMarks,
        evaluatorType: 'AUTO',
      });
    }

    const netScore = scoredMarks - negativeMarksTotal;
    const percentage = totalMarks > 0 ? (netScore / totalMarks) * 100 : 0;
    const accuracyPercentage = attemptedQuestions > 0 ? (correctAnswers / attemptedQuestions) * 100 : 0;
    const timeTakenSeconds = Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000);

    const test = await getPublishedTestOrThrow(attempt.testId).catch(() => null);
    const releaseImmediately = test?.resultVisibility === 'IMMEDIATE';

    const result = await Result.create(
      {
        attemptId,
        userId: attempt.userId,
        testId: attempt.testId,
        status: 'EVALUATED',
        totalQuestions: attemptQuestions.length,
        attemptedQuestions,
        correctAnswers,
        incorrectAnswers,
        unansweredQuestions,
        totalMarks: String(totalMarks),
        scoredMarks: String(scoredMarks),
        negativeMarks: String(negativeMarksTotal),
        percentage: percentage.toFixed(2),
        accuracyPercentage: accuracyPercentage.toFixed(2),
        timeTakenSeconds,
        evaluatedAt: now,
        releasedAt: releaseImmediately ? now : null,
      },
      { transaction },
    );

    await ResultDetail.bulkCreate(
      detailRows.map((row) => ({ ...row, resultId: result.id })),
      { transaction },
    );

    attempt.status = 'SUBMITTED';
    attempt.submittedAt = now;
    attempt.autoSubmitted = autoSubmitted;
    await attempt.save({ transaction });

    return result;
  });
}

export async function getResult(attemptId: string, userId: string) {
  let attempt = await getAttemptOrThrow(attemptId);
  ensureOwnsAttempt(attempt, userId);
  attempt = await autoSubmitIfExpired(attempt);

  if (attempt.status !== 'SUBMITTED') {
    throw new AppError(ErrorCode.NOT_FOUND, 'This attempt has not been submitted yet', 409);
  }

  const result = await Result.findOne({ where: { attemptId } });
  if (!result) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Result not found', 404);
  }

  const test = await getPublishedTestOrThrow(attempt.testId);
  if (test.resultVisibility !== 'IMMEDIATE' && !result.releasedAt) {
    throw new AppError(ErrorCode.RESULT_NOT_RELEASED, 'Result has not been released yet', 403);
  }

  const response: Record<string, unknown> = {
    attemptId,
    status: result.status,
    totalQuestions: result.totalQuestions,
    attemptedQuestions: result.attemptedQuestions,
    unansweredQuestions: result.unansweredQuestions,
    timeTakenSeconds: result.timeTakenSeconds,
  };

  if (test.showScore) {
    response.scoredMarks = result.scoredMarks;
    response.totalMarks = result.totalMarks;
    response.negativeMarks = result.negativeMarks;
    response.percentage = result.percentage;
    response.accuracyPercentage = result.accuracyPercentage;
    response.correctAnswers = result.correctAnswers;
    response.incorrectAnswers = result.incorrectAnswers;
  }
  if (test.showRank) {
    response.rank = result.rank;
  }
  if (test.showPercentile) {
    response.percentile = result.percentile;
  }
  if (test.showCorrectAnswers) {
    const details = await ResultDetail.findAll({ where: { resultId: result.id } });
    response.details = details.map((d) => ({
      questionId: d.questionId,
      selectedOptionId: d.selectedOptionId,
      correctOptionId: d.correctOptionId,
      answerStatus: d.answerStatus,
      marksAwarded: d.marksAwarded,
      negativeMarksAwarded: d.negativeMarksAwarded,
      finalMarks: d.finalMarks,
    }));
  }

  return response;
}
