import { Result, ResultDetail } from '../models';

export async function findResultById(id: string) {
  return Result.findByPk(id);
}

/**
 * Admin-only variant that also joins `user` — kept separate from
 * `findResultById` (shared with the student-facing getResult flow, which
 * doesn't need its own user echoed back) rather than widening the shared
 * function, per ADR-030's "admin views are separate functions" discipline.
 */
export async function findResultByIdForAdmin(id: string) {
  return Result.findByPk(id, { include: [{ association: 'user' }] });
}

export async function findResultByAttemptId(attemptId: string) {
  return Result.findOne({ where: { attemptId } });
}

export async function findEvaluatedResultsForTest(testId: string) {
  return Result.findAll({ where: { testId, status: 'EVALUATED' } });
}

export async function listResultsForTest(testId: string) {
  return Result.findAll({
    where: { testId },
    include: [{ association: 'user' }],
    order: [['scoredMarks', 'DESC']],
  });
}

export async function findResultDetails(resultId: string) {
  return ResultDetail.findAll({ where: { resultId } });
}
