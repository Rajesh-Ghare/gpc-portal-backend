import type { CreationAttributes } from 'sequelize';
import { TestQuestion } from '../models';

export async function listTestQuestions(testId: string) {
  return TestQuestion.findAll({
    where: { testId },
    order: [['displayOrder', 'ASC']],
    include: [{ association: 'question' }, { association: 'questionVersion' }],
  });
}

export async function findTestQuestionById(id: string) {
  return TestQuestion.findByPk(id);
}

export async function findMaxDisplayOrder(testId: string): Promise<number> {
  const last = await TestQuestion.findOne({ where: { testId }, order: [['displayOrder', 'DESC']] });
  return last?.displayOrder ?? 0;
}

export async function createTestQuestion(data: CreationAttributes<TestQuestion>) {
  return TestQuestion.create(data);
}

export async function deleteTestQuestion(testQuestion: TestQuestion) {
  await testQuestion.destroy();
}

export async function countTestQuestions(testId: string): Promise<number> {
  return TestQuestion.count({ where: { testId } });
}
