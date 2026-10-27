import { Module } from '@nestjs/common';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { VttModule } from '../vtt/vtt.module';
import { StoryOutboxService } from './story-outbox.service';
@Module({
  imports: [VttModule],
  controllers: [StoryController],
  providers: [StoryService, StoryOutboxService],
  exports: [StoryService],
})
export class StoryModule {}
