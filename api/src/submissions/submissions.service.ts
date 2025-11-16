import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from './submission.entity';

import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class SubmissionsService {
  private readonly s3: S3Client;

  constructor(
    @InjectRepository(Submission)
    private submissionsRepo: Repository<Submission>,
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
    const submission = this.submissionsRepo.create({
      userId,
      pitId: dto.pitId,
      s3Key: dto.fileKey,
      status: 'PENDING',
    });

    await this.submissionsRepo.save(submission);

    return {
      status: 'ok',
      submissionId: submission.id,
    };
  }
}
