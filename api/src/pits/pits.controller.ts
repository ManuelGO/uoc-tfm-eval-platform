import {
  Controller,
  Get,
  UseGuards,
  Delete,
  Param,
  Post,
  Body,
  Patch,
} from '@nestjs/common';
import { PitsService } from './pits.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { CreatePitDto } from './dto/create-pit.dto';
import { UpdatePitDto } from './dto/update-pit.dto';

@UseGuards(AuthGuard)
@Controller('pits')
export class PitsController {
  constructor(private readonly pitsService: PitsService) {}

  // GET /pits
  @Get()
  async findAll() {
    return this.pitsService.findAll();
  }

  // GET /pits/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.pitsService.findOne(id);
  }

  // POST /pits
  // Should be restricted to teachers/admins in the future
  @Post()
  async createPit(@Body() dto: CreatePitDto) {
    const pit = await this.pitsService.create(dto);
    return pit;
  }

  // PATCH /pits/:id
  // Should be restricted to teachers/admins in the future
  @Patch(':id')
  async updatePit(@Param('id') id: string, @Body() dto: UpdatePitDto) {
    const pit = await this.pitsService.update(id, dto);
    return pit;
  }

  // DELETE /pits/:id
  // Admin-only endpoint (TODO: role-based authorization)
  @Delete(':id')
  async deletePit(@Param('id') id: string) {
    await this.pitsService.deletePit(id);
    return { status: 'ok' };
  }
}
