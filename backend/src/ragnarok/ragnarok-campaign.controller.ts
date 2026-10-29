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
import { BindRagnarokCharacterDto } from './dto/bind-ragnarok-character.dto';
import { RagnarokCampaignService } from './ragnarok-campaign.service';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/ragnarok-characters')
export class RagnarokCampaignController {
  constructor(private readonly service: RagnarokCampaignService) {}

  @Get()
  list(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.list(campaignId, user.userId);
  }

  @Post()
  bind(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: BindRagnarokCharacterDto,
  ) {
    return this.service.bind(campaignId, user.userId, dto.characterId);
  }

  @Delete(':characterId')
  unbind(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Param('characterId') characterId: string,
  ) {
    return this.service.unbind(campaignId, user.userId, characterId);
  }
}
