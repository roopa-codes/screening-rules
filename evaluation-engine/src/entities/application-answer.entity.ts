import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigint } from '../common/bigint.transformer';

@Entity('application_answers')
export class ApplicationAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'application_id', type: 'bigint', transformer: bigint })
  applicationId: number;

  @Column({ name: 'question_id', type: 'bigint', transformer: bigint })
  questionId: number;

  /** Raw JSON answer: "Hyderabad", 4, true ... */
  @Column({ type: 'jsonb', nullable: true })
  value: unknown;
}
