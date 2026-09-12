import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as topicRepo from '../repositories/topicRepository';
import { getSubjectOrThrow } from './subjectService';
import { slugify } from '../utils/slugify';

export async function listTopics(filter: { subjectId?: string } = {}) {
  return topicRepo.listTopics(filter);
}

export async function getTopicOrThrow(id: string) {
  const topic = await topicRepo.findTopicById(id);
  if (!topic) {
    throw new AppError(ErrorCode.TOPIC_NOT_FOUND, 'Topic not found', 404);
  }
  return topic;
}

async function ensureSlugAvailable(subjectId: string, slug: string, excludeId?: string) {
  const existing = await topicRepo.findTopicBySubjectAndSlug(subjectId, slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError(
      ErrorCode.DUPLICATE_SLUG,
      `A topic with slug "${slug}" already exists under this subject`,
      409,
    );
  }
}

export interface TopicInput {
  subjectId: string;
  parentTopicId?: string | null;
  name: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
}

export async function createTopic(input: TopicInput) {
  await getSubjectOrThrow(input.subjectId);
  if (input.parentTopicId) {
    const parent = await getTopicOrThrow(input.parentTopicId);
    if (parent.subjectId !== input.subjectId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'parentTopicId must belong to the same subject',
        422,
      );
    }
  }

  const slug = input.slug ?? slugify(input.name);
  await ensureSlugAvailable(input.subjectId, slug);

  return topicRepo.createTopic({
    subjectId: input.subjectId,
    parentTopicId: input.parentTopicId ?? null,
    name: input.name,
    slug,
    description: input.description ?? null,
    isActive: input.isActive ?? true,
  });
}

export async function updateTopic(id: string, input: Partial<TopicInput>) {
  const topic = await getTopicOrThrow(id);
  const subjectId = input.subjectId ?? topic.subjectId;

  if (input.subjectId && input.subjectId !== topic.subjectId) {
    await getSubjectOrThrow(input.subjectId);
  }
  if (input.parentTopicId) {
    const parent = await getTopicOrThrow(input.parentTopicId);
    if (parent.subjectId !== subjectId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'parentTopicId must belong to the same subject',
        422,
      );
    }
  }

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : undefined);
  if (nextSlug && nextSlug !== topic.slug) {
    await ensureSlugAvailable(subjectId, nextSlug, id);
  }

  return topicRepo.updateTopic(topic, {
    ...input,
    slug: nextSlug ?? topic.slug,
  });
}

export async function deleteTopic(id: string) {
  const topic = await getTopicOrThrow(id);
  await topicRepo.softDeleteTopic(topic);
}
