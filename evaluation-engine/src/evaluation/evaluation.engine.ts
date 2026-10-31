import { Outcome, OUTCOME_SEVERITY } from '../common/enums';
import { EVALUATOR_REGISTRY } from './evaluators/registry';
import {
  EvaluationOutcome, InvalidRuleError, RuleDefinition, RuleEvaluator, RuleResult,
} from './evaluation.types';

function isMissing(answer: unknown): boolean {
  return answer === undefined || answer === null || (typeof answer === 'string' && answer.trim() === '');
}

/**
 * Stable order so the same inputs always produce the same output (including reason text).
 * Natural sort on rule code: R1, R2, ..., R10.
 */
function sortRules(rules: RuleDefinition[]): RuleDefinition[] {
  return [...rules].sort(
    (a, b) => a.code.localeCompare(b.code, 'en', { numeric: true, sensitivity: 'base' }) || a.id - b.id,
  );
}

/**
 * Pure function: no DB, no clock, no randomness.
 * Same rules + same answers => same outcome and same reason.
 */
export function evaluate(
  rules: RuleDefinition[],
  answers: Record<string, unknown>,
  registry: ReadonlyMap<string, RuleEvaluator> = EVALUATOR_REGISTRY,
): EvaluationOutcome {
  const ruleResults: RuleResult[] = sortRules(rules).map((rule) => evaluateRule(rule, answers, registry));

  if (ruleResults.length === 0) {
    return { outcome: Outcome.PASS, reason: 'No screening rules configured', decidingRules: [], ruleResults };
  }

  const outcome = ruleResults.reduce<Outcome>(
    (worst, r) => (OUTCOME_SEVERITY[r.outcome] > OUTCOME_SEVERITY[worst] ? r.outcome : worst),
    Outcome.PASS,
  );

  if (outcome === Outcome.PASS) {
    return { outcome, reason: 'All rules met', decidingRules: [], ruleResults };
  }

  const deciding = ruleResults.filter((r) => r.outcome === outcome);
  return {
    outcome,
    reason: deciding.map((r) => r.message).join('; '),
    decidingRules: deciding.map((r) => r.code),
    ruleResults,
  };
}

function evaluateRule(
  rule: RuleDefinition,
  answers: Record<string, unknown>,
  registry: ReadonlyMap<string, RuleEvaluator>,
): RuleResult {
  const answer = answers?.[rule.questionKey];
  const base = { ruleId: rule.id, code: rule.code, answer: answer ?? null };

  if (isMissing(answer)) {
    return {
      ...base,
      status: 'MISSING',
      outcome: rule.onMissing,
      message: `${rule.code}: ${rule.label} question unanswered`,
    };
  }

  const evaluator = registry.get(rule.type);
  if (!evaluator) {
    // Unknown rule type: never auto-reject on our own config problem.
    return {
      ...base,
      status: 'INVALID',
      outcome: Outcome.REVIEW,
      message: `${rule.code}: rule type ${rule.type} is not supported, needs manual review`,
    };
  }

  try {
    const { met, message } = evaluator.check(answer, rule);
    return {
      ...base,
      status: met ? 'MET' : 'NOT_MET',
      outcome: met ? Outcome.PASS : rule.onFail,
      message: `${rule.code}: ${message}`,
    };
  } catch (err) {
    if (!(err instanceof InvalidRuleError)) throw err;
    return {
      ...base,
      status: 'INVALID',
      outcome: Outcome.REVIEW,
      message: `${rule.code}: could not check ${rule.label} (${err.message}), needs manual review`,
    };
  }
}
