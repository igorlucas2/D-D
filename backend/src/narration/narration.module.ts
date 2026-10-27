import { Module } from '@nestjs/common';
import { VttModule } from '../vtt/vtt.module';
import { NarrationController } from './narration.controller';
import { NarrationService } from './narration.service';

@Module({
  imports: [VttModule],
  providers: [NarrationService],
  controllers: [NarrationController],
  exports: [NarrationService],
})
export class NarrationModule {}
