import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pit } from './pit.entity';
import { Repository } from 'typeorm';

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
