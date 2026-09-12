import type { CreationAttributes, InferAttributes } from 'sequelize';
import { Test } from '../models';

export interface TestFilter {
  competitiveExamId?: string;
  testSeriesId?: string;
  status?: string;
}

export async function listTests(filter: TestFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.competitiveExamId) where.competitiveExamId = filter.competitiveExamId;
  if (filter.testSeriesId) where.testSeriesId = filter.testSeriesId;
  if (filter.status) where.status = filter.status;

  return Test.findAll({ where, order: [['createdAt', 'DESC']] });
}

export async function findTestById(id: string) {
  return Test.findByPk(id);
}

export async function findTestWithDetail(id: string) {
  return Test.findByPk(id, {
    include: [
      { association: 'sections' },
      { association: 'testQuestions' },
      { association: 'testRules', include: [{ association: 'tags' }] },
    ],
  });
}

export async function findTestBySlug(slug: string) {
  return Test.findOne({ where: { slug } });
}

export async function createTest(data: CreationAttributes<Test>) {
  return Test.create(data);
}

export async function updateTest(test: Test, data: Partial<InferAttributes<Test>>) {
  test.set(data);
  await test.save();
  return test;
}

export async function softDeleteTest(test: Test) {
  await test.destroy();
}
