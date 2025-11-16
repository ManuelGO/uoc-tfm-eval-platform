import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Submission } from '../submissions/submission.entity';

@Entity('pits')
export class Pit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Código/hash del “pozo de entrega” que comparte el profesor
  @Column({ unique: true })
  code: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => User, (user) => user.ownedPits, { nullable: true })
  owner?: User;

  @OneToMany(() => Submission, (submission) => submission.pit)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
