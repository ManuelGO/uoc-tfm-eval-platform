import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pit } from './pit.entity';
import { Repository } from 'typeorm';
import { CreatePitDto } from './dto/create-pit.dto';
import { UpdatePitDto } from './dto/update-pit.dto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class PitsService {
  private readonly s3: S3Client;

  constructor(
    @InjectRepository(Pit)
    private readonly pitRepo: Repository<Pit>,
  ) {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
    });
  }

  async findAll(): Promise<Pit[]> {
    return this.pitRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Pit> {
    const pit = await this.pitRepo.findOne({ where: { id } });

    if (!pit) {
      throw new NotFoundException('Pit not found');
    }

    return pit;
  }

  async create(dto: CreatePitDto): Promise<Pit> {
    const pit = this.pitRepo.create({
      ...dto,
      testCommand: dto.testCommand ?? 'mvn -q test',
      maxTimeoutMs: dto.maxTimeoutMs ?? 60000,
    });

    return this.pitRepo.save(pit);
  }

  async update(id: string, dto: UpdatePitDto): Promise<Pit> {
    const pit = await this.findOne(id);

    Object.assign(pit, dto);

    return this.pitRepo.save(pit);
  }

  async deletePit(id: string): Promise<void> {
    const pit = await this.pitRepo.findOne({ where: { id } });

    if (!pit) {
      throw new NotFoundException('Pit not found');
    }

    await this.pitRepo.remove(pit);
  }

  async uploadTests(
    id: string,
    file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ): Promise<{ status: string; key: string }> {
    const pit = await this.pitRepo.findOne({ where: { id } });

    if (!pit) {
      throw new NotFoundException('Pit not found');
    }

    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate buffer
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is empty or invalid');
    }

    // Validate extension
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('File must be a .zip file');
    }

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET is not configured');
    }

    const key = `pits/${id}/tests.zip`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: 'application/zip',
    });

    await this.s3.send(command);

    pit.testsS3Key = key;
    await this.pitRepo.save(pit);

    return { status: 'ok', key };
  }
}
