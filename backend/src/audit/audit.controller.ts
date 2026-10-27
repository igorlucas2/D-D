import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = take ? Number.parseInt(take, 10) : undefined;
    return this.audit.list(campaignId, user.userId, {
      take:
        parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
      cursor: cursor || undefined,
    });
  }
}
