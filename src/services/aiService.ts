import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as aiRepo from '../repositories/aiRepository';
import { getSubjectOrThrow } from './subjectService';
import { getTopicOrThrow } from './topicService';
import * as questionService from './questionService';
import { getAIService } from '../strategies/ai';
import { env } from '../config/env';
import { QuestionTranslation } from '../models';
import type { GeneratedQuestionCandidate } from '../strategies/ai/AIService';
import type { createAiJobSchema } from '../validations/ai.validation';
import type { AuditContext } from './questionService';

type CreateAiJobInput = z.infer<typeof createAiJobSchema>;

export async function listJobs(filter: aiRepo.JobFilter = {}) {
  return aiRepo.listJobs(filter);
}

export async function getJobOrThrow(id: string) {
  const job = await aiRepo.findJobById(id);
  if (!job) {
    throw new AppError(ErrorCode.AI_JOB_NOT_FOUND, 'AI generation job not found', 404);
  }
  return job;
}

export async function getJobDetailOrThrow(id: string) {
  const job = await aiRepo.findJobWithItems(id);
  if (!job) {
    throw new AppError(ErrorCode.AI_JOB_NOT_FOUND, 'AI generation job not found', 404);
  }
  return job;
}

/**
 * Flags an obvious near-duplicate: an exact (normalized) text match against
 * an already-APPROVED question in the same subject. Intentionally simple —
 * docs/AI.md defers a real similarity strategy (embeddings, etc.) to when
 * it's actually needed; this is enough to catch the common "AI regenerated
 * the same question" case without a new dependency.
 */
export async function findDuplicateQuestion(subjectId: string, candidate: GeneratedQuestionCandidate): Promise<string | null> {
  const primary = candidate.translations[0];
  if (!primary) return null;
  const normalized = primary.questionText.trim().toLowerCase();

  const matches = await QuestionTranslation.findAll({
    where: { languageCode: primary.languageCode },
    include: [
      {
        association: 'questionVersion',
        required: true,
        include: [{ association: 'question', required: true, where: { subjectId, reviewStatus: 'APPROVED' } }],
      },
    ],
  });

  const found = matches.find((m) => m.questionText.trim().toLowerCase() === normalized);
  return found?.questionVersion?.question?.id ?? null;
}

/**
 * Runs synchronously (the mock provider has no real latency to hide behind
 * a queue) but still models the job/item structure a real async provider
 * would need, so swapping in a real AIService later doesn't change the
 * shape of this function's callers.
 */
export async function createGenerationJob(input: CreateAiJobInput, adminId: string) {
  await getSubjectOrThrow(input.subjectId);
  if (input.topicId) {
    const topic = await getTopicOrThrow(input.topicId);
    if (topic.subjectId !== input.subjectId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'topicId must belong to subjectId', 422);
    }
  }

  const questionType = input.questionType ?? 'MCQ_SINGLE';
  const difficulty = input.difficulty ?? 'MEDIUM';
  const languageCode = input.languageCode ?? 'en';

  const job = await aiRepo.createJob({
    requestedBy: adminId,
    subjectId: input.subjectId,
    topicId: input.topicId ?? null,
    competitiveExamId: input.competitiveExamId ?? null,
    questionType,
    difficulty,
    languageCode,
    requestedCount: input.requestedCount,
    provider: env.aiProvider,
    status: 'PROCESSING',
    startedAt: new Date(),
  });

  const gateway = getAIService();
  let candidates: GeneratedQuestionCandidate[];
  try {
    candidates = await gateway.generateQuestions({
      subjectId: input.subjectId,
      topicId: input.topicId ?? null,
      competitiveExamId: input.competitiveExamId ?? null,
      questionType,
      difficulty,
      languageCode,
      count: input.requestedCount,
    });
  } catch (err) {
    await aiRepo.updateJob(job, {
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : 'Unknown AI provider error',
      completedAt: new Date(),
    });
    throw new AppError(ErrorCode.AI_GENERATION_FAILED, 'AI question generation failed', 502);
  }

  for (const candidate of candidates) {
    const duplicateMatchQuestionId = await findDuplicateQuestion(input.subjectId, candidate);
    await aiRepo.createItem({
      jobId: job.id,
      status: 'PENDING_REVIEW',
      rawOutput: candidate as unknown as Record<string, unknown>,
      validationErrors: [],
      duplicateMatchQuestionId,
    });
  }

  await aiRepo.updateJob(job, {
    status: 'COMPLETED',
    generatedCount: candidates.length,
    completedAt: new Date(),
  });

  return getJobDetailOrThrow(job.id);
}

async function getOwnItemOrThrow(jobId: string, itemId: string) {
  const item = await aiRepo.findItemById(itemId);
  if (!item || item.jobId !== jobId) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Generation item not found', 404);
  }
  return item;
}

/**
 * The human review step ADR-011 requires: creates a real question (via the
 * same questionService.createQuestion transaction every manually-authored
 * question goes through — never a parallel "AI question" table/path) and
 * immediately approves it, since the admin reviewing and approving this
 * item *is* that mandatory human review.
 */
export async function approveItem(jobId: string, itemId: string, adminId: string, context: AuditContext = {}) {
  const job = await getJobOrThrow(jobId);
  const item = await getOwnItemOrThrow(jobId, itemId);

  if (item.status !== 'PENDING_REVIEW') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Item cannot be approved from status ${item.status}`, 409);
  }

  const candidate = item.rawOutput as unknown as GeneratedQuestionCandidate;
  const { question } = await questionService.createQuestion(
    {
      subjectId: job.subjectId!,
      topicId: job.topicId ?? undefined,
      questionType: candidate.questionType,
      difficulty: candidate.difficulty,
      defaultLanguageCode: candidate.defaultLanguageCode,
      marks: candidate.marks,
      negativeMarks: candidate.negativeMarks,
      explanation: candidate.explanation,
      solutionSteps: candidate.solutionSteps,
      translations: candidate.translations,
      options: candidate.options,
    },
    adminId,
    {
      generationJobId: job.id,
      provider: job.provider,
      model: job.model,
      promptVersion: job.promptVersion,
    },
  );

  await questionService.approveQuestion(question.id, adminId, context);

  await aiRepo.updateItem(item, {
    status: 'APPROVED',
    questionId: question.id,
    reviewedBy: adminId,
    reviewedAt: new Date(),
  });

  await aiRepo.updateJob(job, { approvedCount: job.approvedCount + 1 });

  return aiRepo.findItemById(itemId);
}

export async function rejectItem(jobId: string, itemId: string, adminId: string, reason?: string) {
  const job = await getJobOrThrow(jobId);
  const item = await getOwnItemOrThrow(jobId, itemId);

  if (item.status !== 'PENDING_REVIEW') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Item cannot be rejected from status ${item.status}`, 409);
  }

  await aiRepo.updateItem(item, {
    status: 'REJECTED',
    reviewedBy: adminId,
    reviewedAt: new Date(),
    validationErrors: reason ? [reason] : [],
  });

  await aiRepo.updateJob(job, { failedCount: job.failedCount + 1 });

  return aiRepo.findItemById(itemId);
}
