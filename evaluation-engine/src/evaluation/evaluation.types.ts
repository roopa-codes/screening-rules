import { Outcome } from '../common/enums';

/** Plain rule shape the engine works on (a rules row joined with its question). */
export interface RuleDefinition {
  id: number;
  /** rules.rule_code, e.g. "R1" */
  code: string;
  /** Short noun used in reasons, e.g. "location". params.label or questions.label. */
  label: string;
  /** questions.question_key; answers are looked up by this key. */
  questionKey: string;
  /** rules.rule_type_code */
  type: string;
  params: Record<string, unknown>;
  onFail: Outcome;
  onMissing: Outcome;
}

export type RuleStatus = 'MET' | 'NOT_MET' | 'MISSING' | 'INVALID';

export interface RuleResult {
  ruleId: number;
  code: string;
  status: RuleStatus;
  outcome: Outcome;
  /** Plain-language message, always prefixed with the rule code. */
  message: string;
  answer: unknown;
}

export interface EvaluationOutcome {
  outcome: Outcome;
  reason: string;
  /** Codes of the rules that decided the outcome (empty on PASS). */
  decidingRules: string[];
  ruleResults: RuleResult[];
}

/** What an evaluator returns for an answered question. */
export interface CheckResult {
  met: boolean;
  /** Explanation without the code prefix, e.g. "location Pune is not an allowed location". */
  message: string;
}

export interface RuleEvaluator {
  readonly type: string;
  /** Throw InvalidRuleError for bad params or an answer of the wrong type. */
  check(answer: unknown, rule: RuleDefinition): CheckResult;
}

export class InvalidRuleError extends Error {}
