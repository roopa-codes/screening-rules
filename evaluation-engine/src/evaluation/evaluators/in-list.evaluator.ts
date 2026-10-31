import { RuleTypeCode } from '../../common/enums';
import { CheckResult, InvalidRuleError, RuleDefinition, RuleEvaluator } from '../evaluation.types';

export class InListEvaluator implements RuleEvaluator {
  readonly type = RuleTypeCode.IN_LIST;

  check(answer: unknown, rule: RuleDefinition): CheckResult {
    const values = rule.params.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new InvalidRuleError('params.values must be a non-empty list');
    }
    if (typeof answer !== 'string') {
      throw new InvalidRuleError(`expected text answer, got ${typeof answer}`);
    }
    const normalized = answer.trim().toLowerCase();
    const met = values.some((v) => String(v).trim().toLowerCase() === normalized);
    return {
      met,
      message: met
        ? `${rule.label} ${answer.trim()} is allowed`
        : `${rule.label} ${answer.trim()} is not an allowed ${rule.label}`,
    };
  }
}
