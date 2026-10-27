import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
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
import { CampaignChanged } from '../realtime/campaign-changed.decorator';
import { PlayerIntentsService } from './player-intents.service';
class IntentDto {
  @IsUUID() requestKey: string;
  @IsString() @Matches(/\S/) @MaxLength(191) playerEntityId: string;
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(191)
  focusEntityId?: string;
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(191)
  parentTurnId?: string;
  @IsString() @Matches(/\S/) @MaxLength(1500) prompt: string;
  @IsInt() @Min(1) expectedSceneRevision: number;
}
class ReplyDto {
  @IsString() @Matches(/\S/) @MaxLength(2000) text: string;
  @IsIn(['ANSWER', 'ASK']) kind: 'ANSWER' | 'ASK';
  @IsIn(['DRAFT', 'MANUAL']) source: 'DRAFT' | 'MANUAL';
  @IsInt() @Min(1) expectedRevision: number;
}
@Controller('campaigns/:id/intents')
@UseGuards(JwtAuthGuard)
export class PlayerIntentsController {
  constructor(private readonly service: PlayerIntentsService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  state(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.service.state(id, user.userId);
  }
  @CampaignChanged()
  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  submit(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: IntentDto,
  ) {
    return this.service.submit(id, user.userId, dto);
  }
  @CampaignChanged()
  @Post(':turnId/respond')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  respond(
    @Param('id') id: string,
    @Param('turnId') turnId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: ReplyDto,
  ) {
    return this.service.respond(id, user.userId, turnId, dto);
  }
  @CampaignChanged()
  @Post(':turnId/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancel(
    @Param('id') id: string,
    @Param('turnId') turnId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.cancel(id, user.userId, turnId);
  }
}
