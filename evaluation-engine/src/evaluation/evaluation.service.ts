import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThan } from 'typeorm';
import { EvaluationTrigger, Outcome, toNotMetOutcome } from '../common/enums';
import {
  Application, ApplicationAnswer, AuditLog, Override, Question, Rule, RuleResultRow, RuleSetVersion,
  ScreeningEvaluation,
} from '../entities';
import { evaluate } from './evaluation.engine';
import { EvaluationOutcome, RuleDefinition } from './evaluation.types';

const REEVALUATE_BATCH_SIZE = 100;

export interface OverrideInput {
  toOutcome: Outcome;
  comment: string;
  overriddenBy: number;
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);
  private readonly activeStatus: string;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.activeStatus = config.get<string>('RULE_SET_ACTIVE_STATUS', 'ACTIVE');
  }

  /** Dry run: evaluate arbitrary rules/answers without touching the DB. */
  preview(rules: RuleDefinition[], answers: Record<string, unknown>): EvaluationOutcome {
    return evaluate(rules, answers);
  }

  /**
   * Evaluate one application against its job's active rule set version and store the result.
   * Idempotent per (application, rule_set_version): safe for SQS at-least-once delivery.
   * Returns null when the job has no active rule set yet.
   */
  async evaluateApplication(applicationId: number, trigger: EvaluationTrigger): Promise<ScreeningEvaluation | null> {
    return this.dataSource.transaction(async (em) => {
      // Row lock serialises concurrent events for the same application.
      const app = await em.findOne(Application, { where: { id: applicationId }, lock: { mode: 'pessimistic_write' } });
      if (!app) throw new NotFoundException(`Application ${applicationId} not found`);

      const ruleSet = await this.findActiveRuleSet(em, app.jobId);
      if (!ruleSet) {
        this.logger.warn(`Job ${app.jobId} has no ${this.activeStatus} rule set; application ${app.id} not evaluated`);
        return null;
      }

      const existing = await em.findOneBy(ScreeningEvaluation, { applicationId: app.id, ruleSetVersionId: ruleSet.id });
      if (existing) return existing;

      const [rules, answers] = await Promise.all([this.loadRules(em, ruleSet.id), this.loadAnswers(em, app.id)]);
      const result = evaluate(rules, answers);
      return this.persist(em, app, ruleSet, result, trigger);
    });
  }

  /**
   * Called when a job's rules change. Always uses the job's *currently* active rule set,
   * so late or duplicate events can't roll results back to an older version.
   */
  async reevaluateJob(jobId: number, trigger = EvaluationTrigger.RULES_UPDATED) {
    const summary = { jobId, ruleSetVersionId: null as number | null, total: 0, evaluated: 0, changed: 0, keptOverride: 0, failed: 0 };

    const ruleSet = await this.findActiveRuleSet(this.dataSource.manager, jobId);
    if (!ruleSet) {
      this.logger.warn(`Job ${jobId} has no ${this.activeStatus} rule set; nothing to re-evaluate`);
      return summary;
    }
    summary.ruleSetVersionId = ruleSet.id;

    // Keyset pagination so large jobs don't load everything at once.
    let lastId = 0;
    for (;;) {
      const batch = await this.dataSource.getRepository(Application).find({
        select: { id: true, finalOutcome: true },
        where: { jobId, id: MoreThan(lastId) },
        order: { id: 'ASC' },
        take: REEVALUATE_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      for (const app of batch) {
        summary.total++;
        try {
          const res = await this.evaluateApplication(app.id, trigger);
          if (!res) continue;
          summary.evaluated++;
          const after = await this.dataSource.getRepository(Application).findOneBy({ id: app.id });
          if (after?.finalOutcome !== app.finalOutcome) summary.changed++;
          if (after?.finalOutcome !== res.outcome) summary.keptOverride++;
        } catch (err) {
          summary.failed++;
          this.logger.error(`Re-evaluation failed for application ${app.id}`, err as Error);
        }
      }
      lastId = batch[batch.length - 1].id;
    }

    this.logger.log(`Re-evaluated job ${jobId}: ${JSON.stringify(summary)}`);
    return summary;
  }

  /** Resolve job id for a rule set version (for events that only carry rule_set_version_id). */
  async jobIdForRuleSet(ruleSetVersionId: number): Promise<number> {
    const rs = await this.dataSource.getRepository(RuleSetVersion).findOneBy({ id: ruleSetVersionId });
    if (!rs) throw new NotFoundException(`Rule set version ${ruleSetVersionId} not found`);
    return rs.jobId;
  }

  /** Recruiter override. Append-only: previous overrides are deactivated, never deleted. */
  async override(applicationId: number, input: OverrideInput): Promise<Override> {
    return this.dataSource.transaction(async (em) => {
      const app = await em.findOne(Application, { where: { id: applicationId }, lock: { mode: 'pessimistic_write' } });
      if (!app) throw new NotFoundException(`Application ${applicationId} not found`);

      const current = await em.findOneBy(ScreeningEvaluation, { applicationId, isCurrent: true });
      if (!current) throw new BadRequestException(`Application ${applicationId} has not been evaluated yet`);

      const fromOutcome = app.finalOutcome ?? current.outcome;
      await em.update(Override, { applicationId, isActive: true }, { isActive: false });
      const override = await em.save(
        em.create(Override, {
          applicationId,
          evaluationId: current.id,
          fromOutcome,
          toOutcome: input.toOutcome,
          comment: input.comment,
          overriddenBy: input.overriddenBy,
          isActive: true,
        }),
      );
      await em.update(Application, { id: applicationId }, { finalOutcome: input.toOutcome });
      await this.audit(em, {
        actorUserId: input.overriddenBy,
        action: 'OVERRIDE_CREATED',
        entityId: applicationId,
        beforeData: { finalOutcome: fromOutcome },
        afterData: { finalOutcome: input.toOutcome, overrideId: override.id, evaluationId: current.id, comment: input.comment },
      });
      return override;
    });
  }

  async getStatus(applicationId: number) {
    const app = await this.dataSource.getRepository(Application).findOneBy({ id: applicationId });
    if (!app) throw new NotFoundException(`Application ${applicationId} not found`);

    const [current, override] = await Promise.all([
      this.dataSource.getRepository(ScreeningEvaluation).findOneBy({ applicationId, isCurrent: true }),
      this.dataSource.getRepository(Override).findOneBy({ applicationId, isActive: true }),
    ]);

    return {
      applicationId,
      finalOutcome: app.finalOutcome,
      decidedBy: override ? 'RECRUITER_OVERRIDE' : current ? 'RULES' : null,
      evaluation: current ? await this.withRuleResults(current) : null,
      override,
      // Rules were re-run after the override and now disagree with it: prompt the recruiter, don't undo it.
      overrideNeedsReview:
        !!override && !!current && override.evaluationId !== current.id && current.outcome !== override.toOutcome,
    };
  }

  async getHistory(applicationId: number) {
    const [evaluations, overrides] = await Promise.all([
      this.dataSource.getRepository(ScreeningEvaluation).find({ where: { applicationId }, order: { id: 'ASC' } }),
      this.dataSource.getRepository(Override).find({ where: { applicationId }, order: { id: 'ASC' } }),
    ]);
    return { applicationId, evaluations: await Promise.all(evaluations.map((e) => this.withRuleResults(e))), overrides };
  }

  // ---------------------------------------------------------------------------

  private async findActiveRuleSet(em: EntityManager, jobId: number): Promise<RuleSetVersion | null> {
    return em.findOne(RuleSetVersion, {
      where: { jobId, status: this.activeStatus },
      order: { versionNo: 'DESC' },
    });
  }

  /** rules for a version joined with their questions -> engine RuleDefinitions. */
  private async loadRules(em: EntityManager, ruleSetVersionId: number): Promise<RuleDefinition[]> {
    const rules = await em.find(Rule, { where: { ruleSetVersionId } });
    const questions = await this.questionsById(em, rules.map((r) => r.questionId));

    return rules.map((r) => {
      const q = questions.get(r.questionId);
      const params = r.params ?? {};
      return {
        id: r.id,
        code: r.ruleCode,
        label: typeof params.label === 'string' ? params.label : (q?.label ?? `question ${r.questionId}`),
        // Unknown question -> key that never matches -> treated as unanswered (REVIEW by default).
        questionKey: q?.questionKey ?? `__missing_question_${r.questionId}`,
        type: r.ruleTypeCode,
        params,
        onFail: toNotMetOutcome(r.onFail),
        onMissing: toNotMetOutcome(r.onMissing),
      };
    });
  }

  /** application_answers -> { question_key: value } */
  private async loadAnswers(em: EntityManager, applicationId: number): Promise<Record<string, unknown>> {
    const answers = await em.find(ApplicationAnswer, { where: { applicationId } });
    const questions = await this.questionsById(em, answers.map((a) => a.questionId));
    const map: Record<string, unknown> = {};
    for (const a of answers) {
      const q = questions.get(a.questionId);
      if (q) map[q.questionKey] = a.value;
    }
    return map;
  }

  private async questionsById(em: EntityManager, ids: number[]): Promise<Map<number, Question>> {
    if (ids.length === 0) return new Map();
    const rows = await em.find(Question, { where: { id: In([...new Set(ids)]) } });
    return new Map(rows.map((q) => [q.id, q]));
  }

  private async persist(
    em: EntityManager,
    app: Application,
    ruleSet: RuleSetVersion,
    result: EvaluationOutcome,
    trigger: EvaluationTrigger,
  ): Promise<ScreeningEvaluation> {
    const current = await em.findOneBy(ScreeningEvaluation, { applicationId: app.id, isCurrent: true });
    let becomesCurrent = true;
    if (current) {
      const currentSet = await em.findOneBy(RuleSetVersion, { id: current.ruleSetVersionId });
      // Never let an older rule set version replace a newer one.
      becomesCurrent = !currentSet || currentSet.versionNo < ruleSet.versionNo;
      if (becomesCurrent) await em.update(ScreeningEvaluation, { id: current.id }, { isCurrent: false });
    }

    const evaluation = await em.save(
      em.create(ScreeningEvaluation, {
        applicationId: app.id,
        ruleSetVersionId: ruleSet.id,
        outcome: result.outcome,
        reason: result.reason,
        isCurrent: becomesCurrent,
      }),
    );

    await em.save(
      RuleResultRow,
      result.ruleResults.map((r) => ({
        evaluationId: evaluation.id,
        ruleId: r.ruleId,
        outcome: r.outcome,
        actualValue: r.answer ?? null,
        reason: r.message,
      })),
    );

    // A recruiter override is never silently undone: final_outcome only follows the rules when none is active.
    const activeOverride = await em.findOneBy(Override, { applicationId: app.id, isActive: true });
    const before = app.finalOutcome;
    let after = before;
    if (becomesCurrent && !activeOverride) {
      after = result.outcome;
      if (after !== before) await em.update(Application, { id: app.id }, { finalOutcome: after });
    } else if (activeOverride && activeOverride.toOutcome !== result.outcome) {
      this.logger.warn(
        `Application ${app.id}: rules v${ruleSet.versionNo} say ${result.outcome}, keeping recruiter override ${activeOverride.toOutcome}`,
      );
    }

    await this.audit(em, {
      actorUserId: null,
      action: 'SCREENING_EVALUATED',
      entityId: app.id,
      beforeData: { finalOutcome: before },
      afterData: {
        finalOutcome: after,
        evaluationId: evaluation.id,
        ruleSetVersionId: ruleSet.id,
        versionNo: ruleSet.versionNo,
        outcome: result.outcome,
        reason: result.reason,
        isCurrent: becomesCurrent,
        keptOverrideId: activeOverride?.id ?? null,
        trigger,
      },
    });

    return evaluation;
  }

  private async withRuleResults(evaluation: ScreeningEvaluation) {
    const ruleResults = await this.dataSource
      .getRepository(RuleResultRow)
      .find({ where: { evaluationId: evaluation.id }, order: { id: 'ASC' } });
    return { ...evaluation, ruleResults };
  }

  private audit(
    em: EntityManager,
    entry: { actorUserId: number | null; action: string; entityId: number; beforeData: unknown; afterData: unknown },
  ) {
    return em.save(AuditLog, { ...entry, entityType: 'application' });
  }
}
