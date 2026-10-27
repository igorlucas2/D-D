import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Audit } from '../audit/audit.decorator';
import { CampaignChanged } from '../realtime/campaign-changed.decorator';
import { CombatService } from './combat.service';
import { CombatActionsService } from './combat-actions.service';
import { ItemUseService } from './item-use.service';
import { SpellCastService } from './spell-cast.service';
import { WeaponAttackService } from './weapon-attack.service';
import { DeathSaveService } from './death-save.service';
import { CombatActionDto } from './combat-action.dto';
import { UseItemDto } from './item-use.dto';
import { CastSpellDto } from './spell-cast.dto';
import { WeaponAttackDto } from './weapon-attack.dto';
import { DeathSaveDto } from './death-save.dto';
import { StartEncounterDto } from './dto/start-encounter.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/combat')
export class CombatController {
  constructor(
    private readonly combatService: CombatService,
    private readonly actions: CombatActionsService,
    private readonly items: ItemUseService,
    private readonly spells: SpellCastService,
    private readonly weapons: WeaponAttackService,
    private readonly deathSaves: DeathSaveService,
  ) {}

  @CampaignChanged()
  @Audit('combat.death-save', 'combat')
  @Post('death-save')
  @HttpCode(200)
  deathSave(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: DeathSaveDto,
  ) {
    return this.deathSaves.roll(campaignId, user.userId, dto);
  }

  @CampaignChanged()
  @Audit('combat.attack', 'combat')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('attacks')
  @HttpCode(200)
  attack(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: WeaponAttackDto,
  ) {
    return this.weapons.attack(campaignId, user.userId, dto);
  }

  @CampaignChanged()
  @Audit('spell.cast', 'spell')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('spells/cast')
  @HttpCode(200)
  castSpell(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CastSpellDto,
  ) {
    return this.spells.cast(campaignId, user.userId, dto);
  }

  @CampaignChanged()
  @Audit('item.use', 'item')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('items/use')
  @HttpCode(200)
  useItem(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UseItemDto,
  ) {
    return this.items.use(campaignId, user.userId, dto);
  }

  @Get('actions')
  actionHistory(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Query('take') take?: string,
  ) {
    return this.actions.history(
      campaignId,
      user.userId,
      take ? parseInt(take, 10) : undefined,
    );
  }

  @CampaignChanged()
  @Audit('combat.action', 'combat')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('actions')
  @HttpCode(200)
  applyAction(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CombatActionDto,
  ) {
    return this.actions.apply(campaignId, user.userId, dto);
  }

  @Get()
  getEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.getEncounter(campaignId, user.userId);
  }

  @Audit('combat.start', 'encounter')
  @Post()
  startEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: StartEncounterDto,
  ) {
    return this.combatService.startEncounter(campaignId, user.userId, dto);
  }

  @Audit('combat.update', 'encounter')
  @Patch()
  updateEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateEncounterDto,
  ) {
    return this.combatService.updateEncounter(campaignId, user.userId, dto);
  }

  @Audit('combat.end', 'encounter')
  @Delete()
  endEncounter(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.endEncounter(campaignId, user.userId);
  }

  @Audit('combat.participant.add', 'participant')
  @Post('participants')
  addParticipant(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AddParticipantDto,
  ) {
    return this.combatService.addParticipant(campaignId, user.userId, dto);
  }

  @Audit('combat.participant.update', 'participant')
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

  @Audit('combat.participant.remove', 'participant')
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

  @CampaignChanged()
  @Audit('combat.next-turn', 'encounter')
  @Post('next-turn')
  nextTurn(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.nextTurn(campaignId, user.userId);
  }

  @CampaignChanged()
  @Audit('combat.end-turn', 'encounter')
  @Post('end-turn')
  @HttpCode(200)
  endTurn(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.combatService.endTurn(campaignId, user.userId);
  }
}
