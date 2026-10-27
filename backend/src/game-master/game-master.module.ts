import { Module } from '@nestjs/common';
import { GameActionsModule } from '../game-actions/game-actions.module';
import { StoryModule } from '../story/story.module';
import { GameMasterController } from './game-master.controller';
import { GameMasterService } from './game-master.service';
import { GameMasterContext } from './game-master.context';
import { GameMasterProvider, OllamaProvider } from './ollama.provider';
import { PlayerIntentsController } from './player-intents.controller';
import { PlayerIntentsService } from './player-intents.service';
@Module({
  imports: [GameActionsModule, StoryModule],
  controllers: [GameMasterController, PlayerIntentsController],
  providers: [
    GameMasterService,
    GameMasterContext,
    PlayerIntentsService,
    { provide: GameMasterProvider, useClass: OllamaProvider },
  ],
  exports: [GameMasterService],
})
export class GameMasterModule {}
