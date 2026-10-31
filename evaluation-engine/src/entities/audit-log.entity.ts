import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** null = system (the evaluation engine itself). */
  @Column({ name: 'actor_user_id', type: 'bigint', nullable: true, transformer: bigint })
  actorUserId: number | null;

  @Column({ type: 'text' })
  action: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType: string;

  @Column({ name: 'entity_id', type: 'bigint', transformer: bigint })
  entityId: number;

  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData: unknown;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
