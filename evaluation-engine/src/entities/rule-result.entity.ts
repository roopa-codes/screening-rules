import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

@Entity('rule_results')
export class RuleResultRow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'evaluation_id', type: 'bigint', transformer: bigint })
  evaluationId: number;

  @Column({ name: 'rule_id', type: 'bigint', transformer: bigint })
  ruleId: number;

  @Column({ type: 'text' })
  outcome: string;

  @Column({ name: 'actual_value', type: 'jsonb', nullable: true })
  actualValue: unknown;

  @Column({ type: 'text' })
  reason: string;
}
