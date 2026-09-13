import { Attempt } from '../models';

export interface AttemptFilter {
  testId?: string;
  userId?: string;
  status?: string;
}

export async function listAttempts(filter: AttemptFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.testId) where.testId = filter.testId;
  if (filter.userId) where.userId = filter.userId;
  if (filter.status) where.status = filter.status;

  return Attempt.findAll({
    where,
    include: [{ association: 'user' }, { association: 'test' }],
    order: [['createdAt', 'DESC']],
  });
}
