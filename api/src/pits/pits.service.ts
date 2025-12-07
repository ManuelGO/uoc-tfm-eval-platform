import { Injectable } from '@nestjs/common';
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
}
