import type { CreationAttributes, InferAttributes } from 'sequelize';
import { AiGenerationItem, AiGenerationJob } from '../models';

export interface JobFilter {
  status?: string;
  subjectId?: string;
}

export async function listJobs(filter: JobFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.subjectId) where.subjectId = filter.subjectId;

  return AiGenerationJob.findAll({ where, order: [['createdAt', 'DESC']] });
}

export async function createJob(data: CreationAttributes<AiGenerationJob>) {
  return AiGenerationJob.create(data);
}

export async function findJobById(id: string) {
  return AiGenerationJob.findByPk(id);
}

export async function findJobWithItems(id: string) {
  return AiGenerationJob.findByPk(id, { include: [{ association: 'items' }] });
}

export async function updateJob(job: AiGenerationJob, data: Partial<InferAttributes<AiGenerationJob>>) {
  job.set(data);
  await job.save();
  return job;
}

export async function createItem(data: CreationAttributes<AiGenerationItem>) {
  return AiGenerationItem.create(data);
}

export async function findItemById(id: string) {
  return AiGenerationItem.findByPk(id);
}

export async function updateItem(item: AiGenerationItem, data: Partial<InferAttributes<AiGenerationItem>>) {
  item.set(data);
  await item.save();
  return item;
}
