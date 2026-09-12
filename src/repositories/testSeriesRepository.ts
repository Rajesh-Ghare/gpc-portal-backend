import type { CreationAttributes, InferAttributes } from 'sequelize';
import { TestSeries } from '../models';

export async function listSeries(filter: { competitiveExamId?: string } = {}) {
  return TestSeries.findAll({
    where: filter.competitiveExamId ? { competitiveExamId: filter.competitiveExamId } : {},
    order: [['displayOrder', 'ASC']],
  });
}

export async function findSeriesById(id: string) {
  return TestSeries.findByPk(id);
}

export async function findSeriesBySlug(slug: string) {
  return TestSeries.findOne({ where: { slug } });
}

export async function createSeries(data: CreationAttributes<TestSeries>) {
  return TestSeries.create(data);
}

export async function updateSeries(series: TestSeries, data: Partial<InferAttributes<TestSeries>>) {
  series.set(data);
  await series.save();
  return series;
}

export async function softDeleteSeries(series: TestSeries) {
  await series.destroy();
}
