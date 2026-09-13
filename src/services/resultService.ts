import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as resultRepo from '../repositories/resultRepository';
import { getTestOrThrow } from './testService';
import { recordAudit } from './auditLogService';
import { computeRankings } from '../utils/rankings';
import type { AuditContext } from './questionService';

export async function getResultOrThrow(id: string) {
  const result = await resultRepo.findResultById(id);
  if (!result) {
    throw new AppError(ErrorCode.RESULT_NOT_FOUND, 'Result not found', 404);
  }
  return result;
}

export async function listResultsForTest(testId: string) {
  await getTestOrThrow(testId);
  return resultRepo.listResultsForTest(testId);
}

export async function getResultDetailForAdmin(id: string) {
  const result = await getResultOrThrow(id);
  const details = await resultRepo.findResultDetails(id);
  return { result, details };
}

/**
 * Recomputes rank/percentile for every EVALUATED result of a test (a
 * cross-attempt aggregate — see docs/DECISIONS.md ADR-027 for why this
 * isn't done inline during submission) and releases any not yet released.
 * Safe to call repeatedly: already-released results keep their original
 * releasedAt, but rank/percentile are always refreshed to reflect the
 * current full set of evaluated attempts.
 */
export async function releaseResults(testId: string, actorId: string, context: AuditContext = {}) {
  await getTestOrThrow(testId);
  const results = await resultRepo.findEvaluatedResultsForTest(testId);

  const rankings = computeRankings(
    results.map((r) => ({ id: r.id, netScore: Number(r.scoredMarks) - Number(r.negativeMarks) })),
  );
  const rankingById = new Map(rankings.map((r) => [r.id, r]));

  const now = new Date();
  let releasedCount = 0;

  for (const result of results) {
    const ranking = rankingById.get(result.id);
    if (ranking) {
      result.rank = ranking.rank;
      result.percentile = ranking.percentile.toFixed(2);
    }
    if (!result.releasedAt) {
      result.releasedAt = now;
      releasedCount += 1;
    }
    await result.save();
  }

  await recordAudit({
    actorId,
    action: 'result.release',
    entityType: 'test',
    entityId: testId,
    afterData: { totalResults: results.length, releasedCount },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { totalResults: results.length, releasedCount, alreadyReleasedCount: results.length - releasedCount };
}
