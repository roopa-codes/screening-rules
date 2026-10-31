import { RuleEvaluator } from '../evaluation.types';
import { BooleanEvaluator } from './boolean.evaluator';
import { InListEvaluator } from './in-list.evaluator';
import { MaxNumberEvaluator, MinNumberEvaluator } from './number.evaluator';

/** To add a new kind of rule: add a RuleTypeCode (and a rule_types row), write an evaluator, register it here. */
const EVALUATORS: RuleEvaluator[] = [
  new InListEvaluator(),
  new MinNumberEvaluator(),
  new MaxNumberEvaluator(),
  new BooleanEvaluator(),
];

export const EVALUATOR_REGISTRY: ReadonlyMap<string, RuleEvaluator> = new Map(
  EVALUATORS.map((e) => [e.type, e]),
);
