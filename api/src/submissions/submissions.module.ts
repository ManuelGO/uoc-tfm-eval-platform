import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsService } from './submissions.service';
import { Submission } from './submission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission])],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
