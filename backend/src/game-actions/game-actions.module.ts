import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { GameActionsController } from './game-actions.controller';
import { GameActionsService } from './game-actions.service';

@Module({
  imports: [CombatModule],
  controllers: [GameActionsController],
  providers: [GameActionsService],
  exports: [GameActionsService],
})
export class GameActionsModule {}
