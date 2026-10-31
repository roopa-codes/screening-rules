import { RuleTypeCode } from '../../common/enums';
import { CheckResult, InvalidRuleError, RuleDefinition, RuleEvaluator } from '../evaluation.types';

function toNumber(answer: unknown): number {
  const n = typeof answer === 'string' ? Number(answer.trim()) : answer;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new InvalidRuleError(`expected a number, got "${String(answer)}"`);
  }
  return n;
}

function describe(value: number, rule: RuleDefinition): string {
  const unit = typeof rule.params.unit === 'string' ? `${rule.params.unit} of ` : '';
  return `${value} ${unit}${rule.label}`;
}

export class MinNumberEvaluator implements RuleEvaluator {
  readonly type = RuleTypeCode.MIN_NUMBER;

  check(answer: unknown, rule: RuleDefinition): CheckResult {
    const min = rule.params.min;
    if (typeof min !== 'number') throw new InvalidRuleError('params.min must be a number');
    const value = toNumber(answer);
    return {
      met: value >= min,
      message: `${describe(value, rule)}, ${min} required`,
    };
  }
}

export class MaxNumberEvaluator implements RuleEvaluator {
  readonly type = RuleTypeCode.MAX_NUMBER;

  check(answer: unknown, rule: RuleDefinition): CheckResult {
    const max = rule.params.max;
    if (typeof max !== 'number') throw new InvalidRuleError('params.max must be a number');
    const value = toNumber(answer);
    return {
      met: value <= max,
      message: `${describe(value, rule)}, at most ${max} allowed`,
    };
  }
}
