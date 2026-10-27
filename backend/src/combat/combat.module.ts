import { Module } from '@nestjs/common';
import { VttModule } from '../vtt/vtt.module';
import { CombatService } from './combat.service';
import { CombatController } from './combat.controller';

@Module({
  imports: [VttModule],
  providers: [CombatService],
  controllers: [CombatController],
  exports: [CombatService],
})
export class CombatModule {}
