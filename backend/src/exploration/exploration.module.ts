import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharactersModule } from '../characters/characters.module';
import { WorldModule } from '../world/world.module';
import { NarrationModule } from '../narration/narration.module';
import { ExplorationService } from './exploration.service';
import { ExplorationController } from './exploration.controller';

@Module({
  imports: [AuthModule, CharactersModule, WorldModule, NarrationModule],
  providers: [ExplorationService],
  controllers: [ExplorationController],
})
export class ExplorationModule {}
