import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Submission, SubmissionStatus } from './submission.entity';
import { Pit } from '../pits/pit.entity';

import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { User } from '../users/user.entity';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SqsService } from 'src/queue/sqs.service';

@Injectable()
export class SubmissionsService {
  private readonly s3: S3Client;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepo: Repository<Submission>,

    @InjectRepository(Pit)
    private readonly pitRepo: Repository<Pit>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    private readonly sqs: SqsService,
  ) {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
    });
  }

  async requestUpload(dto: RequestUploadDto, userId: string) {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET is not configured');
    }

    const s3Key = `submissions/${userId}/${dto.pitId}/${Date.now()}.zip`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: 'application/zip',
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300, // 5 minutos
    });

    return { uploadUrl, fileKey: s3Key };
  }

  async confirmUpload(dto: ConfirmUploadDto, userId: string) {
    const { pitId, fileKey } = dto;

    // 1) Basic validation
    if (!fileKey) {
      throw new BadRequestException('fileKey is required');
    }

    if (!fileKey.endsWith('.zip')) {
      throw new BadRequestException('File must be a .zip');
    }

    // Expected pattern: submissions/<userId>/<pitId>/<something>.zip
    const segments = fileKey.split('/');

    if (segments.length < 4 || segments[0] !== 'submissions') {
      throw new BadRequestException('Invalid fileKey format');
    }

    const [, userIdFromKey, pitIdFromKey] = segments;

    if (userIdFromKey !== userId) {
      throw new ForbiddenException(
        'fileKey does not belong to the authenticated user',
      );
    }

    if (pitIdFromKey !== pitId) {
      throw new ForbiddenException('fileKey does not match provided pitId');
    }

    // 2) Ensure PIT exists
    const pit: Pit | null = await this.pitRepo.findOne({
      where: { id: pitId },
    });

    if (!pit) {
      throw new NotFoundException('Pit not found');
    }

    const user: User | null = await this.usersRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 3) Create new submission with status PENDING
    const submission = this.submissionsRepo.create({
      pit,
      s3Key: fileKey,
      status: SubmissionStatus.PENDING,
      // Relations by id; TypeORM crea el FK
      user,
    });

    await this.submissionsRepo.save(submission);

    await this.sqs.sendSubmissionEnqueued(submission);

    return {
      status: 'ok',
      submissionId: submission.id,
    };
  }
}
