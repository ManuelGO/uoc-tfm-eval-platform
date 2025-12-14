import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pit } from './pit.entity';

/**
 * Service to automatically create a test PIT in the database.
 *
 * This service is intended solely for debugging and testing purposes
 * during system development. It creates a PIT with a fixed ID that can be
 * used for end-to-end testing without needing to manually create PITs
 * through the interface.
 *
 * NOTE: This service runs automatically on application startup
 * and checks if the dummy PIT already exists before creating it.
 */
@Injectable()
export class DummyPitSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Pit)
    private readonly pitRepository: Repository<Pit>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const dummyPitId = '11111111-1111-1111-1111-111111111111';

    const existing = await this.pitRepository.findOne({
      where: { id: dummyPitId },
    });

    if (existing) {
      console.log('[DummyPitSeedService] Dummy PIT already exists', {
        id: dummyPitId,
        code: existing.code,
      });
      return;
    }

    await this.pitRepository.save({
      id: dummyPitId,
      code: 'DUMMY',
      title: 'Dummy PIT for dev',
      description: 'Dummy PIT used for end-to-end tests from ECS/API.',
      active: true,
    } as Pit);

    console.log('[DummyPitSeedService] Dummy PIT created', {
      id: dummyPitId,
      code: 'DUMMY',
    });
  }
}
