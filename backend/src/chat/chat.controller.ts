import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';
import { SendChatDto } from './dto/send-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('chat')
  history(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.chatService.history(campaignId, user.userId);
  }

  @Post('chat')
  send(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SendChatDto,
  ) {
    return this.chatService.send(campaignId, user.userId, dto);
  }

  @Get('languages')
  languages(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.chatService.languages(campaignId, user.userId);
  }

  @Post('languages/:languageId/characters/:characterId')
  teach(
    @Param('campaignId') campaignId: string,
    @Param('languageId') languageId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.chatService.teach(
      campaignId,
      user.userId,
      languageId,
      characterId,
      true,
    );
  }

  @Delete('languages/:languageId/characters/:characterId')
  forget(
    @Param('campaignId') campaignId: string,
    @Param('languageId') languageId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.chatService.teach(
      campaignId,
      user.userId,
      languageId,
      characterId,
      false,
    );
  }
}
