import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NarrationService } from './narration.service';
import { SaveNarrationDraftDto, SendNarrationDto } from './dto/narration.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/narration')
export class NarrationController {
  constructor(private readonly narrationService: NarrationService) {}

  @Post()
  send(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SendNarrationDto,
  ) {
    return this.narrationService.send(campaignId, user.userId, dto);
  }

  @Get('drafts')
  listDrafts(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.narrationService.listDrafts(campaignId, user.userId);
  }

  @Post('drafts')
  createDraft(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveNarrationDraftDto,
  ) {
    return this.narrationService.createDraft(campaignId, user.userId, dto);
  }

  @Patch('drafts/:draftId')
  updateDraft(
    @Param('campaignId') campaignId: string,
    @Param('draftId') draftId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveNarrationDraftDto,
  ) {
    return this.narrationService.updateDraft(
      campaignId,
      draftId,
      user.userId,
      dto,
    );
  }

  @Delete('drafts/:draftId')
  removeDraft(
    @Param('campaignId') campaignId: string,
    @Param('draftId') draftId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.narrationService.removeDraft(campaignId, draftId, user.userId);
  }
}
