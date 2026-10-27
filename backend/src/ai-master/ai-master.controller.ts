import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Audit } from '../audit/audit.decorator';
import { CampaignChanged } from '../realtime/campaign-changed.decorator';
import { AiMasterService } from './ai-master.service';
import { AiActDto, AiSettingsDto } from './dto/ai-master.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/ai-master')
export class AiMasterController {
  constructor(private readonly service: AiMasterService) {}

  @Get('state')
  state(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.state(campaignId, user.userId);
  }

  @CampaignChanged()
  @Audit('ai-master.settings', 'ai-master')
  @Patch('settings')
  settings(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AiSettingsDto,
  ) {
    return this.service.settings(campaignId, user.userId, dto);
  }

  @CampaignChanged()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('act')
  act(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AiActDto,
  ) {
    return this.service.act(campaignId, user.userId, dto);
  }
}
