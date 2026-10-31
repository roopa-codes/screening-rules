import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

/** Append-only: a new override deactivates the previous one, nothing is deleted. */
@Entity('overrides')
export class Override {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'application_id', type: 'bigint', transformer: bigint })
  applicationId: number;

  /** The evaluation the recruiter was looking at when overriding. */
  @Column({ name: 'evaluation_id', type: 'bigint', transformer: bigint })
  evaluationId: number;

  @Column({ name: 'from_outcome', type: 'text' })
  fromOutcome: string;

  @Column({ name: 'to_outcome', type: 'text' })
  toOutcome: string;

  @Column({ type: 'text' })
  comment: string;

  @Column({ name: 'overridden_by', type: 'bigint', transformer: bigint })
  overriddenBy: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
