import { Op } from 'sequelize';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { Test } from '../models';

const now = () => new Date();

/** Published tests currently within their availability window, if one is set. */
export async function listPublishedTests() {
  return Test.findAll({
    where: {
      status: 'PUBLISHED',
      [Op.and]: [
        { [Op.or]: [{ availableFrom: null }, { availableFrom: { [Op.lte]: now() } }] },
        { [Op.or]: [{ availableUntil: null }, { availableUntil: { [Op.gte]: now() } }] },
      ],
    },
    include: [{ association: 'competitiveExam' }, { association: 'testSeries' }],
    order: [['createdAt', 'DESC']],
  });
}

/**
 * The test an existing attempt belongs to, in any status — CLOSED, ARCHIVED,
 * or soft-deleted. Attempts and results are historical records (ADR-008):
 * once a student has taken a test, unpublishing it must not make their
 * result disappear. Only *starting* an attempt requires PUBLISHED.
 */
export async function getTestForAttemptOrThrow(id: string) {
  const test = await Test.findByPk(id, { paranoid: false });
  if (!test) {
    throw new AppError(ErrorCode.TEST_NOT_FOUND, 'Test not found', 404);
  }
  return test;
}

export async function getPublishedTestOrThrow(id: string) {
  const test = await Test.findOne({
    where: { id, status: 'PUBLISHED' },
    include: [{ association: 'competitiveExam' }, { association: 'testSeries' }, { association: 'sections' }],
  });
  if (!test) {
    throw new AppError(ErrorCode.TEST_NOT_FOUND, 'Test not found', 404);
  }
  return test;
}
