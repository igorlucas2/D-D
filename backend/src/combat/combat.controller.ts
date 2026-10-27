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
import { CombatService } from './combat.service';
import { StartEncounterDto } from './dto/start-encounter.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/combat')
export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  @Get()
  getEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.getEncounter(campaignId, user.userId);
  }

  @Post()
  startEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: StartEncounterDto,
  ) {
    return this.combatService.startEncounter(campaignId, user.userId, dto);
  }

  @Patch()
  updateEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateEncounterDto,
  ) {
    return this.combatService.updateEncounter(campaignId, user.userId, dto);
  }

  @Delete()
  endEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.endEncounter(campaignId, user.userId);
  }

  @Post('participants')
  addParticipant(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AddParticipantDto,
  ) {
    return this.combatService.addParticipant(campaignId, user.userId, dto);
  }

  @Patch('participants/:participantId')
  updateParticipant(
    @Param('campaignId') campaignId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateParticipantDto,
  ) {
    return this.combatService.updateParticipant(
      campaignId,
      user.userId,
      participantId,
      dto,
    );
  }

  @Delete('participants/:participantId')
  removeParticipant(
    @Param('campaignId') campaignId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.removeParticipant(
      campaignId,
      user.userId,
      participantId,
    );
  }

  @Post('next-turn')
  nextTurn(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.nextTurn(campaignId, user.userId);
  }
}
