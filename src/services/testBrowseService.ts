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
