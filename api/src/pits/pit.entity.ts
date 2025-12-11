import { Submission } from 'src/submissions/submission.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('pits')
export class Pit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 255, default: 'mvn test' })
  testCommand: string;

  @Column({ type: 'int', default: 60000 })
  maxTimeoutMs: number;

  @Column({ type: 'jsonb', nullable: true })
  setupCommands?: string[];

  @Column({ type: 'varchar', length: 512, nullable: true })
  testsS3Key: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Submission, (submission) => submission.pit)
  submissions: Submission[];
}
