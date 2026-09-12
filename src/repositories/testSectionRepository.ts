import type { CreationAttributes, InferAttributes } from 'sequelize';
import { TestSection } from '../models';

export async function listSections(testId: string) {
  return TestSection.findAll({ where: { testId }, order: [['displayOrder', 'ASC']] });
}

export async function findSectionById(id: string) {
  return TestSection.findByPk(id);
}

export async function createSection(data: CreationAttributes<TestSection>) {
  return TestSection.create(data);
}

export async function updateSection(section: TestSection, data: Partial<InferAttributes<TestSection>>) {
  section.set(data);
  await section.save();
  return section;
}

export async function deleteSection(section: TestSection) {
  // test_sections is not paranoid (no deleted_at column) — a real DELETE.
  await section.destroy();
}
