import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Audit } from '../audit/audit.decorator';
import { CampaignChanged } from '../realtime/campaign-changed.decorator';
import { ConsequencesService } from './consequences.service';
class RevisionDto {
  @IsInt() @Min(1) expectedRevision: number;
}
class PolicyDto extends RevisionDto {
  @IsBoolean() enabled: boolean;
  @IsBoolean() paused: boolean;
  @IsBoolean() allowNpcTravel: boolean;
  @IsInt() @Min(1) @Max(12) maxPerAdvance: number;
}
class PostponeDto extends RevisionDto {
  @IsInt() @Min(1) @Max(43200) delayMinutes: number;
  @IsBoolean() autoApproved: boolean;
}
class ScheduleDto extends PostponeDto {
  @IsUUID() requestKey: string;
  @IsIn(['REMINDER', 'NPC_DEPART']) kind: 'REMINDER' | 'NPC_DEPART';
  @IsString() @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(2000) text?: string;
  @IsOptional() @IsString() @MaxLength(191) npcEntityId?: string;
  @IsOptional() @IsString() @MaxLength(191) routeId?: string;
}
class ResolveDto extends RevisionDto {
  @IsIn(['APPLY', 'CANCEL']) decision: 'APPLY' | 'CANCEL';
}
class PresetDto extends RevisionDto {
  @IsBoolean() autoApproved: boolean;
}
@Controller('campaigns/:id/consequences')
@UseGuards(JwtAuthGuard)
export class ConsequencesController {
  constructor(private readonly service: ConsequencesService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  state(@Param('id') id: string, @CurrentUser() u: { userId: string }) {
    return this.service.state(id, u.userId);
  }
  @CampaignChanged()
  @Audit('consequences.policy', 'consequences')
  @Patch('policy')
  @Header('Cache-Control', 'no-store')
  policy(
    @Param('id') id: string,
    @CurrentUser() u: { userId: string },
    @Body() b: PolicyDto,
  ) {
    return this.service.policy(id, u.userId, b);
  }
  @CampaignChanged()
  @Audit('consequences.schedule', 'consequence')
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  schedule(
    @Param('id') id: string,
    @CurrentUser() u: { userId: string },
    @Body() b: ScheduleDto,
  ) {
    return this.service.schedule(id, u.userId, b);
  }
  @CampaignChanged()
  @Audit('consequences.preset', 'consequences')
  @Post('preset')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  preset(
    @Param('id') id: string,
    @CurrentUser() u: { userId: string },
    @Body() b: PresetDto,
  ) {
    return this.service.preset(id, u.userId, b);
  }
  @CampaignChanged()
  @Audit('consequences.resolve', 'consequence')
  @Post(':itemId/resolve')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resolve(
    @Param('id') id: string,
    @Param('itemId') item: string,
    @CurrentUser() u: { userId: string },
    @Body() b: ResolveDto,
  ) {
    return this.service.resolve(id, u.userId, item, b);
  }
  @CampaignChanged()
  @Audit('consequences.postpone', 'consequence')
  @Post(':itemId/postpone')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  postpone(
    @Param('id') id: string,
    @Param('itemId') item: string,
    @CurrentUser() u: { userId: string },
    @Body() b: PostponeDto,
  ) {
    return this.service.postpone(id, u.userId, item, b);
  }
}
