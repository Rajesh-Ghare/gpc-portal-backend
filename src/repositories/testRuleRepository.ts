import type { CreationAttributes, InferAttributes } from 'sequelize';
import { TestRule } from '../models';

export async function listRules(testId: string) {
  return TestRule.findAll({
    where: { testId },
    order: [['displayOrder', 'ASC']],
    include: [{ association: 'tags' }],
  });
}

export async function findRuleById(id: string) {
  return TestRule.findByPk(id, { include: [{ association: 'tags' }] });
}

export async function createRule(data: CreationAttributes<TestRule>) {
  return TestRule.create(data);
}

export async function updateRule(rule: TestRule, data: Partial<InferAttributes<TestRule>>) {
  rule.set(data);
  await rule.save();
  return rule;
}

export async function deleteRule(rule: TestRule) {
  await rule.destroy();
}
