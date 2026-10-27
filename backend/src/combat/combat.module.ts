import { Module } from '@nestjs/common';
import { DiceModule } from '../dice/dice.module';
import { VttModule } from '../vtt/vtt.module';
import { CombatService } from './combat.service';
import { CombatActionsService } from './combat-actions.service';
import { ItemUseService } from './item-use.service';
import { SpellCastService } from './spell-cast.service';
import { CombatController } from './combat.controller';

@Module({
  imports: [VttModule, DiceModule],
  providers: [
    CombatService,
    CombatActionsService,
    ItemUseService,
    SpellCastService,
  ],
  controllers: [CombatController],
  exports: [CombatService],
})
export class CombatModule {}
