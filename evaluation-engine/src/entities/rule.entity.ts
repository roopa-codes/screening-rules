import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

@Entity('rules')
export class Rule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rule_set_version_id', type: 'bigint', transformer: bigint })
  ruleSetVersionId: number;

  /** Human id shown in reasons, e.g. "R1". */
  @Column({ name: 'rule_code', type: 'text' })
  ruleCode: string;

  @Column({ name: 'question_id', type: 'bigint', transformer: bigint })
  questionId: number;

  /** FK to rule_types.code, e.g. IN_LIST, MIN_NUMBER, BOOLEAN. */
  @Column({ name: 'rule_type_code', type: 'text' })
  ruleTypeCode: string;

  @Column({ type: 'jsonb' })
  params: Record<string, unknown>;

  /** FAIL or REVIEW when the rule is not met. */
  @Column({ name: 'on_fail', type: 'text' })
  onFail: string;

  /** FAIL or REVIEW when the question is unanswered. */
  @Column({ name: 'on_missing', type: 'text', default: 'REVIEW' })
  onMissing: string;
}
