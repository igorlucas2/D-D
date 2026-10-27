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
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignChanged } from '../realtime/campaign-changed.decorator';
import type { GameOperation } from './game-action.types';
import { GameActionsService } from './game-actions.service';
class RequestActionDto {
  @IsUUID() requestKey: string;
  @IsInt() @Min(1) expectedSceneRevision: number;
  @IsOptional() @IsString() @MaxLength(191) characterEntityId?: string;
  @IsObject() operation: GameOperation;
}
class ResolveActionDto {
  @IsIn(['COMMIT', 'CANCEL', 'REJECT']) decision:
    | 'COMMIT'
    | 'CANCEL'
    | 'REJECT';
  @IsOptional() @IsInt() @Min(1) expectedRevision?: number;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
@Controller('campaigns/:id/game-actions')
@UseGuards(JwtAuthGuard)
export class GameActionsController {
  constructor(private readonly actions: GameActionsService) {}
  @Get('state')
  @Header('Cache-Control', 'private, no-store')
  state(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.actions.state(id, user.userId);
  }
  @CampaignChanged()
  @Post('initialize')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  initialize(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.actions.initialize(id, { kind: 'USER', userId: user.userId });
  }
  @CampaignChanged()
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  request(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() input: RequestActionDto,
  ) {
    return this.actions.request(
      id,
      { kind: 'USER', userId: user.userId },
      input,
    );
  }
  @CampaignChanged()
  @Post(':actionId/resolve')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resolve(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @CurrentUser() user: { userId: string },
    @Body() input: ResolveActionDto,
  ) {
    return this.actions.resolve(
      id,
      actionId,
      { kind: 'USER', userId: user.userId },
      input,
    );
  }
}
