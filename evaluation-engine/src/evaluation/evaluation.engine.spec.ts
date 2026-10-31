import { Outcome, RuleTypeCode } from '../common/enums';
import { evaluate } from './evaluation.engine';
import { RuleDefinition } from './evaluation.types';

// Rules for "Pharmacist – Hyderabad" from the problem statement.
const R1: RuleDefinition = {
  id: 1, code: 'R1', label: 'location', questionKey: 'location', type: RuleTypeCode.IN_LIST,
  params: { values: ['Hyderabad', 'Secunderabad'] }, onFail: Outcome.FAIL, onMissing: Outcome.REVIEW,
};
const R2: RuleDefinition = {
  id: 2, code: 'R2', label: 'experience', questionKey: 'experienceYears', type: RuleTypeCode.MIN_NUMBER,
  params: { min: 3, unit: 'years' }, onFail: Outcome.REVIEW, onMissing: Outcome.REVIEW,
};
const R3: RuleDefinition = {
  id: 3, code: 'R3', label: 'pharmacy license', questionKey: 'hasPharmacyLicense', type: RuleTypeCode.BOOLEAN,
  params: { expected: true }, onFail: Outcome.FAIL, onMissing: Outcome.REVIEW,
};
const RULES = [R1, R2, R3];

describe('evaluation engine – problem statement examples', () => {
  it.each([
    [{ location: 'Pune', experienceYears: 5, hasPharmacyLicense: true }, Outcome.FAIL, 'R1: location Pune is not an allowed location'],
    [{ location: 'Hyderabad', experienceYears: 2, hasPharmacyLicense: true }, Outcome.REVIEW, 'R2: 2 years of experience, 3 required'],
    [{ location: 'Hyderabad', experienceYears: 6, hasPharmacyLicense: true }, Outcome.PASS, 'All rules met'],
    // Unanswered is not the same as "no": route to a human instead of auto-rejecting.
    [{ location: 'Hyderabad', experienceYears: 4 }, Outcome.REVIEW, 'R3: pharmacy license question unanswered'],
  ])('%j -> %s', (answers, outcome, reason) => {
    const res = evaluate(RULES, answers);
    expect(res.outcome).toBe(outcome);
    expect(res.reason).toBe(reason);
  });
});

describe('combining', () => {
  it('Fail beats Review and lists only the failing rules as the reason', () => {
    const res = evaluate(RULES, { location: 'Pune', experienceYears: 1, hasPharmacyLicense: 'no' });
    expect(res.outcome).toBe(Outcome.FAIL);
    expect(res.decidingRules).toEqual(['R1', 'R3']);
    expect(res.reason).toBe('R1: location Pune is not an allowed location; R3: does not hold pharmacy license');
  });

  it('no rules -> Pass', () => {
    expect(evaluate([], {}).outcome).toBe(Outcome.PASS);
  });

  it('missing answer honours onMissing = FAIL', () => {
    const res = evaluate([{ ...R3, onMissing: Outcome.FAIL }], {});
    expect(res.outcome).toBe(Outcome.FAIL);
  });

  it('matches location case-insensitively and trims', () => {
    expect(evaluate([R1], { location: '  secunderabad ' }).outcome).toBe(Outcome.PASS);
  });

  it('badly typed answer goes to Review, never auto-Fail', () => {
    const res = evaluate([R2], { experienceYears: 'lots' });
    expect(res.outcome).toBe(Outcome.REVIEW);
    expect(res.ruleResults[0].status).toBe('INVALID');
  });

  it('unknown rule type goes to Review', () => {
    const res = evaluate([{ ...R1, type: 'REGEX' }], { location: 'x' });
    expect(res.outcome).toBe(Outcome.REVIEW);
  });

  it('orders R10 after R2 (natural sort on rule code)', () => {
    const r10 = { ...R2, id: 10, code: 'R10' };
    const res = evaluate([r10, R2], { experienceYears: 1 });
    expect(res.decidingRules).toEqual(['R2', 'R10']);
  });

  it('recruiter lowers R2 to 2 years -> same applicant now passes', () => {
    const answers = { location: 'Hyderabad', experienceYears: 2, hasPharmacyLicense: true };
    expect(evaluate(RULES, answers).outcome).toBe(Outcome.REVIEW);
    expect(evaluate([R1, { ...R2, params: { min: 2, unit: 'years' } }, R3], answers).outcome).toBe(Outcome.PASS);
  });
});

describe('invariants', () => {
  // Small generated set of answer combinations, including missing/invalid values.
  const locations = ['Hyderabad', 'Pune', '', undefined];
  const years = [0, 2, 3, 10, 'abc', undefined];
  const licenses = [true, false, 'yes', undefined];
  const cases = locations.flatMap((l) => years.flatMap((y) => licenses.map((h) => ({ location: l, experienceYears: y, hasPharmacyLicense: h }))));

  it('is deterministic regardless of rule order', () => {
    for (const answers of cases) {
      const a = evaluate(RULES, answers);
      const b = evaluate([R3, R1, R2], answers);
      expect(b).toEqual(a);
    }
  });

  it('every non-Pass result is explained by the rules that caused it', () => {
    for (const answers of cases) {
      const res = evaluate(RULES, answers);
      if (res.outcome === Outcome.PASS) {
        expect(res.ruleResults.every((r) => r.outcome === Outcome.PASS)).toBe(true);
        continue;
      }
      expect(res.decidingRules.length).toBeGreaterThan(0);
      for (const code of res.decidingRules) {
        const rr = res.ruleResults.find((r) => r.code === code)!;
        expect(rr.outcome).toBe(res.outcome);
        expect(res.reason).toContain(rr.message);
        expect(rr.message.startsWith(`${code}: `)).toBe(true);
      }
      // No rule with the deciding severity is left out of the reason.
      const sameSeverity = res.ruleResults.filter((r) => r.outcome === res.outcome).map((r) => r.code);
      expect(res.decidingRules).toEqual(sameSeverity);
    }
  });
});
