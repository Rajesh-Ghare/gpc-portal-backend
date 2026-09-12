import type { CreationAttributes, InferAttributes } from 'sequelize';
import { ExamCategory } from '../models';

export async function listCategories() {
  return ExamCategory.findAll({ order: [['displayOrder', 'ASC']] });
}

export async function findCategoryById(id: string) {
  return ExamCategory.findByPk(id);
}

export async function findCategoryBySlug(slug: string) {
  return ExamCategory.findOne({ where: { slug } });
}

export async function createCategory(data: CreationAttributes<ExamCategory>) {
  return ExamCategory.create(data);
}

export async function updateCategory(category: ExamCategory, data: Partial<InferAttributes<ExamCategory>>) {
  category.set(data);
  await category.save();
  return category;
}

export async function softDeleteCategory(category: ExamCategory) {
  await category.destroy();
}
