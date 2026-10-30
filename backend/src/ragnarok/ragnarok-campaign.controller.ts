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
import { GrantRagnarokClassDto } from './dto/grant-ragnarok-class.dto';
import { GrantJobExpDto, GrantJobLevelDto } from './dto/grant-job-progress.dto';
import {
  GrantRagnarokItemDto,
  GrantRagnarokZenyDto,
} from './dto/grant-ragnarok-item.dto';
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

  @Post(':characterId/item')
  grantItem(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: GrantRagnarokItemDto,
  ) {
    return this.service.grantItem(campaignId, user.userId, characterId, dto);
  }

  @Post(':characterId/zeny')
  grantZeny(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: GrantRagnarokZenyDto,
  ) {
    return this.service.grantZeny(campaignId, user.userId, characterId, dto);
  }

  @Post(':characterId/class')
  grantClass(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: GrantRagnarokClassDto,
  ) {
    return this.service.grantClass(campaignId, user.userId, characterId, dto);
  }

  @Post(':characterId/job-level')
  grantJobLevel(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: GrantJobLevelDto,
  ) {
    return this.service.grantJobLevel(
      campaignId,
      user.userId,
      characterId,
      dto,
    );
  }

  @Post(':characterId/kafra/save')
  kafraSave(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.kafraSave(campaignId, user.userId, characterId);
  }

  @Post(':characterId/kafra/teleport')
  kafraTeleport(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.kafraTeleport(campaignId, user.userId, characterId);
  }

  @Post(':characterId/job-exp')
  grantJobExp(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: GrantJobExpDto,
  ) {
    return this.service.grantJobExp(campaignId, user.userId, characterId, dto);
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
