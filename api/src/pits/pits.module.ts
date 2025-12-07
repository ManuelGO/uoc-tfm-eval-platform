import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pit } from './pit.entity';
import { PitsService } from './pits.service';
import { PitsController } from './pits.controller';
import { DummyPitSeedService } from './dummy-pit.seed.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Pit]), forwardRef(() => AuthModule)],
  controllers: [PitsController],
  providers: [PitsService, DummyPitSeedService],
  exports: [PitsService],
})
export class PitsModule {}
