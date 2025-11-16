import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Pit } from '../pits/pit.entity';

export type SubmissionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.submissions, { eager: true })
  user: User;

  @ManyToOne(() => Pit, (pit) => pit.submissions, { eager: true })
  pit: Pit;

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
