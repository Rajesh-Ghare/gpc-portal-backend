import type { z } from 'zod';
import { sequelize } from '../models';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as ruleRepo from '../repositories/testRuleRepository';
import { findOrCreateTagByName } from '../repositories/tagRepository';
import { ensureTestEditable, getTestOrThrow } from './testService';
import { getSectionOrThrow } from './testSectionService';
import { getSubjectOrThrow } from './subjectService';
import { getTopicOrThrow } from './topicService';
import type { createRuleSchema, updateRuleSchema } from '../validations/testBuilder.validation';

type CreateRuleInput = z.infer<typeof createRuleSchema>;
type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

export async function listRules(testId: string) {
  await getTestOrThrow(testId);
  return ruleRepo.listRules(testId);
}

export async function getRuleOrThrow(id: string) {
  const rule = await ruleRepo.findRuleById(id);
  if (!rule) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Test rule not found', 404);
  }
  return rule;
}

async function validateFilters(input: { sectionId?: string; subjectId?: string; topicId?: string }, testId: string) {
  if (input.sectionId) {
    const section = await getSectionOrThrow(input.sectionId);
    if (section.testId !== testId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'sectionId must belong to this test', 422);
    }
  }
  if (input.subjectId) {
    await getSubjectOrThrow(input.subjectId);
  }
  if (input.topicId) {
    const topic = await getTopicOrThrow(input.topicId);
    if (input.subjectId && topic.subjectId !== input.subjectId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'topicId must belong to subjectId', 422);
    }
  }
}

export async function createRule(testId: string, input: CreateRuleInput) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);
  await validateFilters(input, testId);

  const rule = await ruleRepo.createRule({
    testId,
    sectionId: input.sectionId ?? null,
    subjectId: input.subjectId ?? null,
    topicId: input.topicId ?? null,
    questionType: input.questionType ?? null,
    difficulty: input.difficulty ?? null,
    languageCode: input.languageCode ?? null,
    questionCount: input.questionCount,
    selectionStrategy: input.selectionStrategy,
    displayOrder: input.displayOrder,
    ruleConfig: input.ruleConfig,
  });

  if (input.tags && input.tags.length > 0) {
    const tags = await sequelize.transaction((transaction) =>
      Promise.all(input.tags!.map((name) => findOrCreateTagByName(name, transaction))),
    );
    await rule.setTags(tags);
  }

  return ruleRepo.findRuleById(rule.id);
}

export async function updateRule(testId: string, id: string, input: UpdateRuleInput) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);
  const rule = await getRuleOrThrow(id);
  if (rule.testId !== testId) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Test rule not found', 404);
  }
  await validateFilters(
    {
      sectionId: input.sectionId,
      subjectId: input.subjectId ?? rule.subjectId ?? undefined,
      topicId: input.topicId,
    },
    testId,
  );

  await ruleRepo.updateRule(rule, input);

  if (input.tags) {
    const tags = await sequelize.transaction((transaction) =>
      Promise.all(input.tags!.map((name) => findOrCreateTagByName(name, transaction))),
    );
    await rule.setTags(tags);
  }

  return ruleRepo.findRuleById(id);
}

export async function deleteRule(testId: string, id: string) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);
  const rule = await getRuleOrThrow(id);
  if (rule.testId !== testId) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Test rule not found', 404);
  }
  await ruleRepo.deleteRule(rule);
}
