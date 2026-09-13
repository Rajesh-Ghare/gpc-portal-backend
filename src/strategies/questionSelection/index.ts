import type { Test } from '../../models';
import type { QuestionSelectionStrategy } from './QuestionSelectionStrategy';
import { ManualSelectionStrategy } from './ManualSelectionStrategy';
import { RuleBasedSelectionStrategy } from './RuleBasedSelectionStrategy';

const manualStrategy = new ManualSelectionStrategy();
const ruleBasedStrategy = new RuleBasedSelectionStrategy();

export function getQuestionSelectionStrategy(test: Test): QuestionSelectionStrategy {
  return test.selectionMode === 'RULE_BASED' ? ruleBasedStrategy : manualStrategy;
}

export type { QuestionSelectionStrategy, SelectedQuestion } from './QuestionSelectionStrategy';
