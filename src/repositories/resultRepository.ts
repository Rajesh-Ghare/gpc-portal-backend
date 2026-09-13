import { Result, ResultDetail } from '../models';

export async function findResultById(id: string) {
  return Result.findByPk(id);
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
