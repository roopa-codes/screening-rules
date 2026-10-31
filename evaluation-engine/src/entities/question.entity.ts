import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'question_key', type: 'text', unique: true })
  questionKey: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ name: 'answer_type', type: 'text' })
  answerType: string;

  @Column({ type: 'jsonb', nullable: true })
  options: unknown;
}
