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
import { Audit } from '../audit/audit.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JoinCampaignDto } from './dto/join-campaign.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.campaignsService.findAllForUser(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(user.userId, dto);
  }

  @Post('join')
  join(@CurrentUser() user: { userId: string }, @Body() dto: JoinCampaignDto) {
    return this.campaignsService.join(user.userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.campaignsService.findOne(id, user.userId);
  }

  @Audit('campaign.update', 'campaign')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, user.userId, dto);
  }

  @Audit('campaign.delete', 'campaign')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.campaignsService.remove(id, user.userId);
  }

  @Delete(':id/members/me')
  leave(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.campaignsService.leave(id, user.userId);
  }

  @Audit('campaign.member.remove', 'member')
  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.campaignsService.removeMember(id, memberUserId, user.userId);
  }
}
