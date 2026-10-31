import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'job_id', type: 'bigint', transformer: bigint })
  jobId: number;

  @Column({ name: 'candidate_id', type: 'bigint', transformer: bigint })
  candidateId: number;

  /** What recruiters see: latest computed outcome, or the active override's to_outcome. */
  @Column({ name: 'final_outcome', type: 'text', nullable: true })
  finalOutcome: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', default: () => 'now()' })
  submittedAt: Date;
}
