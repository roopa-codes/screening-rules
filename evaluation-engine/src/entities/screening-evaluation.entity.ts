import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

/** One row per (application, rule set version). Old rows are kept with is_current = false. */
@Entity('screening_evaluations')
export class ScreeningEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'application_id', type: 'bigint', transformer: bigint })
  applicationId: number;

  @Column({ name: 'rule_set_version_id', type: 'bigint', transformer: bigint })
  ruleSetVersionId: number;

  @Column({ type: 'text' })
  outcome: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'is_current', default: true })
  isCurrent: boolean;

  @CreateDateColumn({ name: 'evaluated_at', type: 'timestamp' })
  evaluatedAt: Date;
}
