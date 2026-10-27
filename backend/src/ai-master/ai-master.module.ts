import { Module } from '@nestjs/common';
import { StoryModule } from '../story/story.module';
import { AiMasterController } from './ai-master.controller';
import { AiMasterService } from './ai-master.service';
import { AiTurnContextBuilder } from './ai-master.context';
import { LocalAiProvider } from './local-ai.provider';

@Module({
  imports: [StoryModule],
  controllers: [AiMasterController],
  providers: [AiMasterService, AiTurnContextBuilder, LocalAiProvider],
  exports: [AiMasterService],
})
export class AiMasterModule {}
