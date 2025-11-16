import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SubmissionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  pitId: string;

  @Column()
  s3Key: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status: SubmissionStatus;

  @Column({ type: 'float', nullable: true })
  score?: number;

  @Column({ type: 'text', nullable: true })
  feedbackSummary?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
