import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PitsService } from './pits.service';
import { Pit } from './pit.entity';
import { DummyPitSeedService } from './dummy-pit.seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pit])],
  providers: [PitsService, DummyPitSeedService],
  exports: [PitsService],
})
export class PitsModule {}
