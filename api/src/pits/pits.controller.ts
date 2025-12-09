import { Controller, Get, UseGuards, Delete, Param } from '@nestjs/common';
import { PitsService } from './pits.service';
import { AuthGuard } from 'src/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('pits')
export class PitsController {
  constructor(private readonly pitsService: PitsService) {}

  // GET /pits
  @Get()
  async findAll() {
    return this.pitsService.findAll();
  }

  // DELETE /pits/:id
  // ⚠️ Admin-only endpoint (should not be used from frontend without role checks)
  // TODO: Add role-based authorization when roles are implemented
  @Delete(':id')
  async deletePit(@Param('id') id: string) {
    await this.pitsService.deletePit(id);
    return { status: 'ok' };
  }
}
