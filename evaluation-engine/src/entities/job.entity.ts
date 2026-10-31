import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'form_id', type: 'bigint', transformer: bigint })
  formId: number;

  @Column({ type: 'text', default: 'OPEN' })
  status: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true, transformer: bigint })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
