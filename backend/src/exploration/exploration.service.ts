import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CharacterExplorationState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CharactersService } from '../characters/characters.service';
import { WorldService } from '../world/world.service';
import { NarrationService } from '../narration/narration.service';
import { TravelDto } from './dto/travel.dto';
import { RestDto } from './dto/rest.dto';
import type { SerializedExplorationState } from './exploration.types';

const DEFAULT_MAX_ACTION_POINTS = 6;
const SHORT_REST_MINUTES = 60;
const LONG_REST_MINUTES = 480;

@Injectable()
export class ExplorationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charactersService: CharactersService,
    private readonly worldService: WorldService,
    private readonly narrationService: NarrationService,
  ) {}

  async getState(campaignId: string, characterId: string, userId: string) {
    await this.assertAccess(campaignId, characterId, userId);
    const state = await this.loadOrCreateState(campaignId, characterId);
    return this.serialize(state);
  }

  async travel(
    campaignId: string,
    characterId: string,
    userId: string,
    dto: TravelDto,
  ) {
    const campaign = await this.assertAccess(campaignId, characterId, userId);
    if (await this.prisma.campaignLore.findUnique({ where: { campaignId } }))
      throw new ConflictException(
        'Neste cenário, abrir mapas não desloca o grupo. Use a viagem coletiva em Comandos da campanha.',
      );
    const state = await this.loadOrCreateState(campaignId, characterId);

    const hotspot = await this.prisma.vttMapHotspot.findUnique({
      where: { id: dto.hotspotId },
      include: { map: true },
    });

    if (!hotspot || hotspot.map.campaignId !== campaignId) {
      throw new NotFoundException('Local não encontrado.');
    }
    if (!hotspot.targetMapId) {
      throw new BadRequestException('Este local não leva a outro mapa.');
    }
    if (state.currentMapId && hotspot.mapId !== state.currentMapId) {
      throw new BadRequestException(
        'Este local não está acessível a partir de onde você está.',
      );
    }
    if (state.actionPoints < hotspot.travelActionCost) {
      throw new BadRequestException(
        'Pontos de ação insuficientes para esta viagem.',
      );
    }

    const updated = await this.prisma.characterExplorationState.update({
      where: { characterId },
      data: {
        currentMapId: hotspot.targetMapId,
        actionPoints: state.actionPoints - hotspot.travelActionCost,
      },
    });

    if (hotspot.travelMinutes > 0) {
      await this.worldService.addMinutes(campaignId, hotspot.travelMinutes);
    }

    if (hotspot.triggerJournalCategory && !hotspot.firstVisitedAt) {
      await this.prisma.vttMapHotspot.update({
        where: { id: hotspot.id },
        data: { firstVisitedAt: new Date() },
      });
      await this.prisma.campaignJournalEntry.create({
        data: {
          campaignId,
          authorId: campaign.masterId,
          title: `Local descoberto: ${hotspot.label}`,
          // `eventNote` é anotação privada do mestre: não vai para o diário,
          // que todos os jogadores leem.
          content: `O grupo chegou a ${hotspot.label}.`,
          category: hotspot.triggerJournalCategory,
        },
      });
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { name: true },
    });
    await this.narrationService.suggestOnArrival(
      campaignId,
      hotspot.targetMapId,
      character?.name ?? 'Um personagem',
    );

    return this.serialize(updated);
  }

  async rest(
    campaignId: string,
    characterId: string,
    userId: string,
    dto: RestDto,
  ) {
    await this.assertAccess(campaignId, characterId, userId);
    if (await this.prisma.campaignLore.findUnique({ where: { campaignId } }))
      throw new ConflictException(
        'Use o descanso coletivo em Comandos da campanha.',
      );
    const state = await this.loadOrCreateState(campaignId, characterId);

    const minutes =
      dto.type === 'long' ? LONG_REST_MINUTES : SHORT_REST_MINUTES;
    const calendar = await this.worldService.addMinutes(campaignId, minutes);

    const character =
      dto.type === 'long'
        ? await this.charactersService.longRest(characterId, userId)
        : await this.charactersService.findOne(characterId, userId);

    const updated = await this.prisma.characterExplorationState.update({
      where: { characterId },
      data: {
        actionPoints: state.maxActionPoints,
        fatigue: dto.type === 'long' ? 0 : Math.max(0, state.fatigue - 1),
        lastRestAtMinutes: calendar.totalMinutes,
      },
    });

    return { state: this.serialize(updated), character };
  }

  private async loadOrCreateState(
    campaignId: string,
    characterId: string,
  ): Promise<CharacterExplorationState> {
    const existing = await this.prisma.characterExplorationState.findUnique({
      where: { characterId },
    });
    if (existing) {
      if (existing.campaignId !== campaignId)
        throw new ConflictException(
          'Esta ficha já está vinculada a outra campanha.',
        );
      return existing;
    }

    return this.prisma.characterExplorationState.create({
      data: {
        characterId,
        campaignId,
        actionPoints: DEFAULT_MAX_ACTION_POINTS,
        maxActionPoints: DEFAULT_MAX_ACTION_POINTS,
      },
    });
  }

  private serialize(
    state: CharacterExplorationState,
  ): SerializedExplorationState {
    return {
      characterId: state.characterId,
      campaignId: state.campaignId,
      currentMapId: state.currentMapId,
      actionPoints: state.actionPoints,
      maxActionPoints: state.maxActionPoints,
      fatigue: state.fatigue,
      lastRestAtMinutes: state.lastRestAtMinutes,
    };
  }

  private async assertAccess(
    campaignId: string,
    characterId: string,
    userId: string,
  ) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!character) {
      throw new NotFoundException('Personagem não encontrado.');
    }
    if (character.userId !== userId) {
      throw new ForbiddenException('Você não tem acesso a este personagem.');
    }
    const binding = await this.prisma.campaignCharacter.findUnique({
      where: { characterId },
    });
    if (binding && binding.campaignId !== campaignId)
      throw new ConflictException(
        'Esta ficha já está vinculada a outra campanha.',
      );

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    const isMember =
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Você não tem acesso a esta campanha.');
    }

    return campaign;
  }
}
