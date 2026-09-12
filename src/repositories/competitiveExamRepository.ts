import type { CreationAttributes, InferAttributes } from 'sequelize';
import { CompetitiveExam } from '../models';

export async function listExams(filter: { categoryId?: string } = {}) {
  return CompetitiveExam.findAll({
    where: filter.categoryId ? { categoryId: filter.categoryId } : {},
    order: [['name', 'ASC']],
  });
}

export async function findExamById(id: string) {
  return CompetitiveExam.findByPk(id);
}

export async function findExamBySlug(slug: string) {
  return CompetitiveExam.findOne({ where: { slug } });
}

export async function createExam(data: CreationAttributes<CompetitiveExam>) {
  return CompetitiveExam.create(data);
}

export async function updateExam(exam: CompetitiveExam, data: Partial<InferAttributes<CompetitiveExam>>) {
  exam.set(data);
  await exam.save();
  return exam;
}

export async function softDeleteExam(exam: CompetitiveExam) {
  await exam.destroy();
}
