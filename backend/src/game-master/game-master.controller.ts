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
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Audit } from '../audit/audit.decorator';
import { CampaignChanged } from '../realtime/campaign-changed.decorator';
import { Throttle } from '@nestjs/throttler';
import { GameMasterService } from './game-master.service';
import type { TurnKind } from './proposal';
class SettingsDto {
  @IsIn(['OFF', 'COPILOT']) mode: 'OFF' | 'COPILOT';
  @IsBoolean() paused: boolean;
  @IsInt() @Min(1) expectedRevision: number;
}
class RequestDto {
  @IsUUID() requestKey: string;
  @IsIn(['PLAN', 'NPC', 'PUBLIC']) kind: TurnKind;
  @IsString() @Matches(/\S/) @MaxLength(1500) prompt: string;
  @IsOptional() @IsString() @MaxLength(191) focusEntityId?: string;
  @IsInt() @Min(1) expectedRevision: number;
}
class ResolveDto {
  @IsIn(['ACCEPT', 'CANCEL']) decision: 'ACCEPT' | 'CANCEL';
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(2000) text?: string;
  @IsOptional() @IsIn(['MASTER', 'PUBLIC']) visibility?: 'MASTER' | 'PUBLIC';
}
@Controller('campaigns/:id/game-master')
@UseGuards(JwtAuthGuard)
export class GameMasterController {
  constructor(private readonly service: GameMasterService) {}
  @Get('state')
  @Header('Cache-Control', 'private, no-store')
  state(@Param('id') id: string, @CurrentUser() u: { userId: string }) {
    return this.service.state(id, u.userId);
  }
  @Get('turns/:turnId')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id') id: string,
    @Param('turnId') turnId: string,
    @CurrentUser() u: { userId: string },
  ) {
    return this.service.detail(id, u.userId, turnId);
  }
  @CampaignChanged()
  @Audit('game-master.settings', 'game-master')
  @Patch('settings')
  @Header('Cache-Control', 'no-store')
  settings(
    @Param('id') id: string,
    @CurrentUser() u: { userId: string },
    @Body() dto: SettingsDto,
  ) {
    return this.service.settings(id, u.userId, dto);
  }
  @CampaignChanged()
  @Audit('game-master.action', 'game-master-turn')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('actions')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  request(
    @Param('id') id: string,
    @CurrentUser() u: { userId: string },
    @Body() dto: RequestDto,
  ) {
    return this.service.request(id, u.userId, dto);
  }
  @CampaignChanged()
  @Audit('game-master.resolve', 'game-master-turn')
  @Post('turns/:turnId/resolve')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resolve(
    @Param('id') id: string,
    @Param('turnId') turnId: string,
    @CurrentUser() u: { userId: string },
    @Body() dto: ResolveDto,
  ) {
    return this.service.resolve(id, u.userId, turnId, dto);
  }
}
