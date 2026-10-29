import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateRagnarokConfigDto } from './dto/update-ragnarok-config.dto';
import { RagnarokCampaignService } from './ragnarok-campaign.service';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/ragnarok-config')
export class RagnarokConfigController {
  constructor(private readonly service: RagnarokCampaignService) {}

  @Get()
  get(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.getConfig(campaignId, user.userId);
  }

  @Patch()
  update(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateRagnarokConfigDto,
  ) {
    return this.service.updateConfig(campaignId, user.userId, dto);
  }
}
