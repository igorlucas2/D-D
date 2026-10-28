import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Audit } from '../audit/audit.decorator';
import { MasterActionsService } from './master-actions.service';
import { GrantItemDto, LevelUpDto } from './dto/master-actions.dto';

@Controller('campaigns/:campaignId/master')
export class MasterActionsController {
  constructor(private readonly actions: MasterActionsService) {}

  @Audit('master.grant-item', 'character')
  @Post('grant-item')
  grantItem(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: GrantItemDto,
  ) {
    return this.actions.grantItem(campaignId, user.userId, dto);
  }

  @Audit('master.level-up', 'character')
  @Post('level-up')
  levelUp(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: LevelUpDto,
  ) {
    return this.actions.levelUp(campaignId, user.userId, dto);
  }
}
