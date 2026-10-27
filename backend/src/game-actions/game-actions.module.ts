import { Module } from '@nestjs/common';
import { GameActionsController } from './game-actions.controller';
import { GameActionsService } from './game-actions.service';
@Module({
  controllers: [GameActionsController],
  providers: [GameActionsService],
  exports: [GameActionsService],
})
export class GameActionsModule {}
