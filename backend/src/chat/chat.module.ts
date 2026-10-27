import { Module } from '@nestjs/common';
import { VttModule } from '../vtt/vtt.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [VttModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
