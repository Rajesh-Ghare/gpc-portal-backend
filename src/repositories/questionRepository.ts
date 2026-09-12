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

export interface ApprovedPoolFilter {
  subjectId?: string | null;
  topicId?: string | null;
  questionType?: string | null;
  difficulty?: string | null;
  tagIds?: string[];
}

/**
 * Counts approved, published questions matching a rule's filters — used to
 * check whether a test_rules row can actually be satisfied before a
 * RULE_BASED test is allowed to publish. Tag filtering is "any of" (a
 * question with at least one of the given tags matches), not "all of".
 */
export async function countApprovedQuestions(filter: ApprovedPoolFilter): Promise<number> {
  const where: Record<string, unknown> = { status: 'PUBLISHED', reviewStatus: 'APPROVED' };
  if (filter.subjectId) where.subjectId = filter.subjectId;
  if (filter.topicId) where.topicId = filter.topicId;
  if (filter.questionType) where.questionType = filter.questionType;
  if (filter.difficulty) where.difficulty = filter.difficulty;

  return Question.count({
    where,
    include:
      filter.tagIds && filter.tagIds.length > 0
        ? [{ association: 'tags', where: { id: filter.tagIds }, required: true }]
        : [],
    distinct: true,
  });
}
