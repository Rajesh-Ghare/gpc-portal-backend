import type { CreationAttributes, InferAttributes } from 'sequelize';
import { Subject } from '../models';

export async function listSubjects() {
  return Subject.findAll({ order: [['name', 'ASC']] });
}

export async function findSubjectById(id: string) {
  return Subject.findByPk(id);
}

export async function findSubjectBySlug(slug: string) {
  return Subject.findOne({ where: { slug } });
}

export async function createSubject(data: CreationAttributes<Subject>) {
  return Subject.create(data);
}

export async function updateSubject(subject: Subject, data: Partial<InferAttributes<Subject>>) {
  subject.set(data);
  await subject.save();
  return subject;
}

export async function softDeleteSubject(subject: Subject) {
  await subject.destroy();
}
