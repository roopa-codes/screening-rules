export enum Outcome {
  PASS = 'PASS',
  REVIEW = 'REVIEW',
  FAIL = 'FAIL',
}

/** Severity order used when combining rule results: FAIL > REVIEW > PASS. */
export const OUTCOME_SEVERITY: Record<Outcome, number> = {
  [Outcome.PASS]: 0,
  [Outcome.REVIEW]: 1,
  [Outcome.FAIL]: 2,
};

/** Codes stored in rule_types.code. Each needs an evaluator in evaluators/registry.ts. */
export enum RuleTypeCode {
  /** Answer must be one of params.values (case-insensitive). */
  IN_LIST = 'IN_LIST',
  /** Numeric answer must be >= params.min. Optional params.unit, e.g. "years". */
  MIN_NUMBER = 'MIN_NUMBER',
  /** Numeric answer must be <= params.max. */
  MAX_NUMBER = 'MAX_NUMBER',
  /** Yes/No answer must equal params.expected (default true). */
  BOOLEAN = 'BOOLEAN',
}

export enum EvaluationTrigger {
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  RULES_UPDATED = 'RULES_UPDATED',
  MANUAL = 'MANUAL',
}

/** Anything that isn't a valid FAIL/REVIEW setting is treated as REVIEW (never auto-reject on bad config). */
export function toNotMetOutcome(value: string | null | undefined): Outcome {
  return value === Outcome.FAIL ? Outcome.FAIL : Outcome.REVIEW;
}
