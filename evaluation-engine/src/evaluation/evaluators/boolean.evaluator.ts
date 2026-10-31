import { RuleTypeCode } from '../../common/enums';
import { CheckResult, InvalidRuleError, RuleDefinition, RuleEvaluator } from '../evaluation.types';

const TRUE_VALUES = new Set(['true', 'yes', 'y', '1']);
const FALSE_VALUES = new Set(['false', 'no', 'n', '0']);

function toBoolean(answer: unknown): boolean {
  if (typeof answer === 'boolean') return answer;
  const s = String(answer).trim().toLowerCase();
  if (TRUE_VALUES.has(s)) return true;
  if (FALSE_VALUES.has(s)) return false;
  throw new InvalidRuleError(`expected yes/no, got "${String(answer)}"`);
}

export class BooleanEvaluator implements RuleEvaluator {
  readonly type = RuleTypeCode.BOOLEAN;

  check(answer: unknown, rule: RuleDefinition): CheckResult {
    const expected = rule.params.expected ?? true;
    if (typeof expected !== 'boolean') throw new InvalidRuleError('params.expected must be a boolean');
    const value = toBoolean(answer);
    const met = value === expected;
    return {
      met,
      message: met
        ? `${rule.label} requirement met`
        : expected
          ? `does not hold ${rule.label}`
          : `holds ${rule.label}, which is not allowed`,
    };
  }
}
