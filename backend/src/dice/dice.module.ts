import { Module } from '@nestjs/common';
import { VttModule } from '../vtt/vtt.module';
import { DiceService } from './dice.service';
import { DiceController } from './dice.controller';

@Module({
  imports: [VttModule],
  providers: [DiceService],
  controllers: [DiceController],
  exports: [DiceService],
})
export class DiceModule {}
