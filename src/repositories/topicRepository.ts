import type { CreationAttributes, InferAttributes } from 'sequelize';
import { Topic } from '../models';

export async function listTopics(filter: { subjectId?: string } = {}) {
  return Topic.findAll({
    where: filter.subjectId ? { subjectId: filter.subjectId } : {},
    order: [['name', 'ASC']],
  });
}

export async function findTopicById(id: string) {
  return Topic.findByPk(id);
}

export async function findTopicBySubjectAndSlug(subjectId: string, slug: string) {
  return Topic.findOne({ where: { subjectId, slug } });
}

export async function createTopic(data: CreationAttributes<Topic>) {
  return Topic.create(data);
}

export async function updateTopic(topic: Topic, data: Partial<InferAttributes<Topic>>) {
  topic.set(data);
  await topic.save();
  return topic;
}

export async function softDeleteTopic(topic: Topic) {
  await topic.destroy();
}
