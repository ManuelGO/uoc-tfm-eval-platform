import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pit } from './pit.entity';
import { Repository } from 'typeorm';
import { CreatePitDto } from './dto/create-pit.dto';
import { UpdatePitDto } from './dto/update-pit.dto';

@Injectable()
export class PitsService {
  constructor(
    @InjectRepository(Pit)
    private readonly pitRepo: Repository<Pit>,
  ) {}

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

    // Note: If there are associated submissions, they will be handled by cascade rules
    // or foreign key constraints defined in the database schema

    await this.pitRepo.remove(pit);
  }
}
