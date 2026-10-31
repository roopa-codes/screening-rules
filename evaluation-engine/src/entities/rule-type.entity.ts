import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('rule_types')
export class RuleType {
  @PrimaryColumn({ type: 'text' })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
