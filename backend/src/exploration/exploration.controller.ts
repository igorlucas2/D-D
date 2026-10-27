import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ExplorationService } from './exploration.service';
import { TravelDto } from './dto/travel.dto';
import { RestDto } from './dto/rest.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/characters/:characterId')
export class ExplorationController {
  constructor(private readonly explorationService: ExplorationService) {}

  @Get('exploration')
  getState(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.explorationService.getState(
      campaignId,
      characterId,
      user.userId,
    );
  }

  @Post('travel')
  travel(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: TravelDto,
  ) {
    return this.explorationService.travel(
      campaignId,
      characterId,
      user.userId,
      dto,
    );
  }

  @Post('rest')
  rest(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: RestDto,
  ) {
    return this.explorationService.rest(
      campaignId,
      characterId,
      user.userId,
      dto,
    );
  }
}
