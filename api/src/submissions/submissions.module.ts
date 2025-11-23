import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

import { Submission } from './submission.entity';
import { Pit } from '../pits/pit.entity';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SqsService } from '../queue/sqs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Pit, User]),
    forwardRef(() => AuthModule),
    UsersModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SqsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
