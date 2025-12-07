import { Controller, Get, UseGuards } from '@nestjs/common';
import { PitsService } from './pits.service';
import { AuthGuard } from 'src/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('pits')
export class PitsController {
  constructor(private readonly pitsService: PitsService) {}

  // GET /pits
  @Get()
  async findAll() {
    // MVP: devolver todos los PITs activos
    return this.pitsService.findAll();
  }
}
