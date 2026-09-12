import { Question, QuestionVersion } from '../models';

export interface QuestionFilter {
  subjectId?: string;
  topicId?: string;
  status?: string;
  reviewStatus?: string;
}

export async function listQuestions(filter: QuestionFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.subjectId) where.subjectId = filter.subjectId;
  if (filter.topicId) where.topicId = filter.topicId;
  if (filter.status) where.status = filter.status;
  if (filter.reviewStatus) where.reviewStatus = filter.reviewStatus;

  return Question.findAll({
    where,
    include: [{ association: 'tags' }],
    order: [['createdAt', 'DESC']],
  });
}

export async function findQuestionById(id: string) {
  return Question.findByPk(id, { include: [{ association: 'tags' }] });
}

export async function findLatestVersion(questionId: string) {
  return QuestionVersion.findOne({
    where: { questionId },
    order: [['versionNumber', 'DESC']],
    include: [
      { association: 'translations' },
      { association: 'options', include: [{ association: 'translations' }] },
    ],
  });
}

export async function findQuestionDetail(id: string) {
  const question = await findQuestionById(id);
  if (!question) return null;
  const latestVersion = await findLatestVersion(id);
  return { question, latestVersion };
}
