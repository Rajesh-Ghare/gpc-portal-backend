import { Op } from 'sequelize';
import type { Test } from '../../models';
import { Question, TestRule } from '../../models';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/errorCodes';
import { findLatestVersion } from '../../repositories/questionRepository';
import { shuffle } from '../../utils/shuffle';
import type { QuestionSelectionStrategy, SelectedQuestion } from './QuestionSelectionStrategy';

/**
 * Evaluates test_rules at attempt-creation time (ADR-010), picking
 * question_count random approved+published questions per rule. A question
 * already used by an earlier rule in the same attempt is excluded, so the
 * same test never selects the same question twice even across rules.
 */
export class RuleBasedSelectionStrategy implements QuestionSelectionStrategy {
  async selectQuestions(test: Test): Promise<SelectedQuestion[]> {
    const rules = await TestRule.findAll({
      where: { testId: test.id },
      order: [['displayOrder', 'ASC']],
      include: [{ association: 'tags' }],
    });

    const selected: SelectedQuestion[] = [];
    const usedQuestionIds = new Set<string>();

    for (const rule of rules) {
      const where: Record<string, unknown> = { status: 'PUBLISHED', reviewStatus: 'APPROVED' };
      if (rule.subjectId) where.subjectId = rule.subjectId;
      if (rule.topicId) where.topicId = rule.topicId;
      if (rule.questionType) where.questionType = rule.questionType;
      if (rule.difficulty) where.difficulty = rule.difficulty;
      if (usedQuestionIds.size > 0) where.id = { [Op.notIn]: Array.from(usedQuestionIds) };

      const tagIds = (rule.tags ?? []).map((t) => t.id);
      const pool = await Question.findAll({
        where,
        include: tagIds.length > 0 ? [{ association: 'tags', where: { id: tagIds }, required: true }] : [],
      });

      if (pool.length < rule.questionCount) {
        throw new AppError(
          ErrorCode.TEST_NOT_AVAILABLE,
          "This test's question rules cannot currently be satisfied — not enough approved questions available",
          409,
        );
      }

      const chosen = shuffle(pool).slice(0, rule.questionCount);
      for (const question of chosen) {
        const version = await findLatestVersion(question.id);
        if (!version) continue;
        usedQuestionIds.add(question.id);
        selected.push({
          questionId: question.id,
          questionVersionId: version.id,
          sectionId: rule.sectionId,
          marks: version.marks ?? test.defaultMarksPerQuestion,
          negativeMarks: version.negativeMarks ?? test.defaultNegativeMarks,
        });
      }
    }

    return selected;
  }
}
