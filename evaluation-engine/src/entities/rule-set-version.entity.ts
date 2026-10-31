import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

@Entity('rule_set_versions')
export class RuleSetVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'job_id', type: 'bigint', transformer: bigint })
  jobId: number;

  @Column({ name: 'version_no', type: 'int' })
  versionNo: number;

  /** DRAFT until published; the engine only evaluates against the active status. */
  @Column({ type: 'text', default: 'DRAFT' })
  status: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true, transformer: bigint })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
