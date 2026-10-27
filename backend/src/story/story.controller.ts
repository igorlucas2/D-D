import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
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
import { StoryService } from './story.service';
import type { StoryOperation } from './story.command';
export class StoryCommandDto {
  @IsUUID() requestKey: string;
  @IsInt() @Min(1) expectedRevision: number;
  @IsObject() operation: StoryOperation;
}
export class StoryQueryDto {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(191) entityId?: string;
  @IsOptional() @IsString() @MaxLength(191) before?: string;
}
@Controller('campaigns/:id/story')
@UseGuards(JwtAuthGuard)
export class StoryController {
  constructor(private readonly story: StoryService) {}
  @Get('knowledge/:entityId')
  @Header('Cache-Control', 'private, no-store')
  knowledge(
    @Param('id') id: string,
    @Param('entityId') entityId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.story.actorKnowledge(id, user.userId, entityId);
  }
  @Get('state')
  @Header('Cache-Control', 'private, no-store')
  state(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Query() query: StoryQueryDto,
  ) {
    return this.story.state(id, user.userId, query);
  }
  @Get('events')
  @Header('Cache-Control', 'private, no-store')
  events(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Query() query: StoryQueryDto,
  ) {
    return this.story.events(id, user.userId, query);
  }
  @Get('facts/:factId/history')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Param('id') id: string,
    @Param('factId') factId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.story.factHistory(id, user.userId, factId);
  }
  @Post('initialize')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  initialize(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.story.initialize(id, user.userId);
  }
  @Post('commands')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  command(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() input: StoryCommandDto,
  ) {
    return this.story.command(id, user.userId, input);
  }
  @Post('corrections')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  correction(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() input: StoryCommandDto,
  ) {
    // Same validator and transaction; this alias never allows a different command kind.
    return this.story.correction(id, user.userId, input);
  }
}
