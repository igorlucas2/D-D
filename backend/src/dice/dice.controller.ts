import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { DiceService } from './dice.service';
import { RollDiceDto } from './dto/roll-dice.dto';

@UseGuards(JwtAuthGuard)
@Controller('dice')
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('roll')
  roll(@CurrentUser() user: { userId: string }, @Body() dto: RollDiceDto) {
    return this.diceService.roll(user.userId, dto);
  }

  @Get('campaign/:campaignId')
  campaignRolls(
    @CurrentUser() user: { userId: string },
    @Param('campaignId') campaignId: string,
  ) {
    return this.diceService.getCampaignRolls(campaignId, user.userId);
  }

  @Get('history')
  history(
    @CurrentUser() user: { userId: string },
    @Query('take') take?: string,
  ) {
    return this.diceService.getHistory(
      user.userId,
      take ? parseInt(take, 10) : undefined,
    );
  }
}
