import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PitsService } from './pits.service';
import { Pit } from './pit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pit])],
  providers: [PitsService],
  exports: [PitsService],
})
export class PitsModule {}
