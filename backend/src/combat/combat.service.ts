import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseStringArray } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';
import { VttGateway } from '../vtt/vtt.gateway';
import { StartEncounterDto } from './dto/start-encounter.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';

const PARTICIPANT_ORDER: Prisma.CombatParticipantOrderByWithRelationInput[] = [
  { initiative: 'desc' },
  { id: 'asc' },
];

const ENCOUNTER_INCLUDE = {
  participants: { orderBy: PARTICIPANT_ORDER },
} satisfies Prisma.CombatEncounterInclude;

type EncounterWithParticipants = Prisma.CombatEncounterGetPayload<{
  include: typeof ENCOUNTER_INCLUDE;
}>;

/** O que mudou no combate; os clientes usam para os efeitos de cena (IM-07). */
export type CombatEvent =
  | { type: 'start' | 'end' | 'roster' | 'display' }
  | { type: 'turn'; participantId: string; round: number }
  | { type: 'conditions'; participantId: string }
  | {
      type: 'hp';
      participantId: string;
      /** null para o jogador quando o PV do inimigo está oculto. */
      delta: number | null;
      hpStatus: HpStatus;
    };

export type HpStatus =
  | 'UNHURT'
  | 'WOUNDED'
  | 'BADLY_WOUNDED'
  | 'NEAR_DEATH'
  | 'DOWN';

export function hpStatus(currentHp: number, maxHp: number): HpStatus {
  if (currentHp <= 0) return 'DOWN';
  if (currentHp >= maxHp) return 'UNHURT';
  const ratio = currentHp / Math.max(maxHp, 1);
  if (ratio >= 0.5) return 'WOUNDED';
  if (ratio >= 0.25) return 'BADLY_WOUNDED';
  return 'NEAR_DEATH';
}

@Injectable()
export class CombatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vttGateway: VttGateway,
  ) {}

  async getEncounter(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);

    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
      include: ENCOUNTER_INCLUDE,
    });

    return encounter
      ? this.serializeEncounter(encounter, campaign.masterId === userId)
      : null;
  }

  async startEncounter(
    campaignId: string,
    userId: string,
    dto: StartEncounterDto,
  ) {
    const campaign = await this.assertIsMaster(campaignId, userId);

    const existing = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
    });
    if (existing) {
      throw new ConflictException(
        'Já existe um combate em andamento nesta campanha.',
      );
    }

    const encounter = await this.prisma.combatEncounter.create({
      data: {
        campaignId,
        name: dto.name?.trim() || 'Combate',
        hpDisplay: campaign.combatHpDisplay,
      },
      include: ENCOUNTER_INCLUDE,
    });

    await this.broadcast(campaignId, { type: 'start' });
    return this.serializeEncounter(encounter, true);
  }

  async updateEncounter(
    campaignId: string,
    userId: string,
    dto: UpdateEncounterDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const encounter = await this.getActiveEncounter(campaignId);

    if (dto.hpDisplay !== undefined) {
      // A escolha vale para este combate e vira o padrao do proximo. O CAS em
      // revision evita que duas abas do mestre sobrescrevam uma à outra.
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.combatEncounter.updateMany({
          where: {
            id: encounter.id,
            ...(dto.expectedRevision !== undefined
              ? { revision: dto.expectedRevision }
              : {}),
          },
          data: {
            hpDisplay: dto.hpDisplay,
            revision: { increment: 1 },
          },
        });
        if (claimed.count === 0) {
          throw new ConflictException(
            'O combate foi alterado por outra pessoa. Recarregue antes de salvar.',
          );
        }
        await tx.campaign.update({
          where: { id: campaignId },
          data: { combatHpDisplay: dto.hpDisplay },
        });
      });
      await this.broadcast(campaignId, { type: 'display' });
    }

    return this.getEncounter(campaignId, userId);
  }

  async endEncounter(campaignId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    await this.prisma.combatEncounter.deleteMany({ where: { campaignId } });
    await this.broadcast(campaignId, { type: 'end' });
    return { success: true };
  }

  async addParticipant(
    campaignId: string,
    userId: string,
    dto: AddParticipantDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const encounter = await this.getActiveEncounter(campaignId);

    let { name, initiative, maxHp, currentHp } = dto;

    if (dto.characterId) {
      const binding = await this.prisma.campaignCharacter.findUnique({
        where: { characterId: dto.characterId },
      });
      if (binding && binding.campaignId !== campaignId)
        throw new ConflictException(
          'Esta ficha está vinculada a outra campanha.',
        );
      const character = await this.prisma.character.findUnique({
        where: { id: dto.characterId },
      });
      if (!character) {
        throw new NotFoundException('Personagem não encontrado.');
      }
      name ??= character.name;
      initiative ??= character.initiative;
      maxHp ??= character.maxHp;
      currentHp ??= character.currentHp;
    }

    if (!name) {
      throw new BadRequestException('Informe um nome para o participante.');
    }

    const resolvedMaxHp = maxHp ?? 1;

    await this.prisma.combatParticipant.create({
      data: {
        encounterId: encounter.id,
        characterId: dto.characterId,
        name,
        initiative: initiative ?? 0,
        maxHp: resolvedMaxHp,
        currentHp: currentHp ?? resolvedMaxHp,
        isAlly: dto.isAlly ?? Boolean(dto.characterId),
      },
    });

    await this.touchEncounter(encounter.id);
    await this.broadcast(campaignId, { type: 'roster' });
    return this.getEncounter(campaignId, userId);
  }

  async updateParticipant(
    campaignId: string,
    userId: string,
    participantId: string,
    dto: UpdateParticipantDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const participant = await this.getOwnedParticipant(
      campaignId,
      participantId,
    );

    const data: Prisma.CombatParticipantUpdateInput = {};
    if (dto.initiative !== undefined) data.initiative = dto.initiative;
    if (dto.maxHp !== undefined) data.maxHp = dto.maxHp;
    if (dto.isAlly !== undefined) data.isAlly = dto.isAlly;
    if (dto.conditions !== undefined) {
      data.conditions = dto.conditions.length
        ? JSON.stringify(dto.conditions)
        : null;
    }
    if (dto.currentHp !== undefined) {
      const cap = dto.maxHp ?? participant.maxHp;
      data.currentHp = Math.max(0, Math.min(dto.currentHp, cap));
    }

    const updated = await this.prisma.combatParticipant.update({
      where: { id: participantId },
      data,
    });
    await this.touchEncounter(participant.encounterId);

    // A ficha acompanha o combate na hora. O PV máximo da ficha vem das
    // regras do personagem, então só o PV atual é copiado (limitado a ele).
    if (updated.characterId && dto.currentHp !== undefined) {
      const character = await this.prisma.character.findUnique({
        where: { id: updated.characterId },
        select: { maxHp: true },
      });
      if (character) {
        await this.prisma.character.update({
          where: { id: updated.characterId },
          data: { currentHp: Math.min(updated.currentHp, character.maxHp) },
        });
      }
    }

    const delta = updated.currentHp - participant.currentHp;
    await this.broadcast(
      campaignId,
      delta !== 0
        ? {
            type: 'hp',
            participantId,
            delta,
            hpStatus: hpStatus(updated.currentHp, updated.maxHp),
          }
        : dto.conditions !== undefined
          ? { type: 'conditions', participantId }
          : { type: 'roster' },
    );
    return this.getEncounter(campaignId, userId);
  }

  async removeParticipant(
    campaignId: string,
    userId: string,
    participantId: string,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const participant = await this.getOwnedParticipant(
      campaignId,
      participantId,
    );

    await this.prisma.combatParticipant.delete({
      where: { id: participantId },
    });

    const remaining = await this.prisma.combatParticipant.count({
      where: { encounterId: participant.encounterId },
    });
    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { id: participant.encounterId },
    });
    if (encounter) {
      await this.prisma.combatEncounter.update({
        where: { id: encounter.id },
        data: {
          revision: { increment: 1 },
          ...(remaining > 0 && encounter.turnIndex >= remaining
            ? { turnIndex: 0 }
            : {}),
        },
      });
    }

    await this.broadcast(campaignId, { type: 'roster' });
    return this.getEncounter(campaignId, userId);
  }

  async nextTurn(campaignId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);

    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
      include: ENCOUNTER_INCLUDE,
    });

    if (!encounter) {
      throw new NotFoundException(
        'Nenhum combate em andamento nesta campanha.',
      );
    }
    if (encounter.participants.length === 0) {
      throw new BadRequestException(
        'Adicione participantes antes de avançar o turno.',
      );
    }

    const nextIndex = encounter.turnIndex + 1;
    const wrapped = nextIndex >= encounter.participants.length;

    const turnIndex = wrapped ? 0 : nextIndex;
    const round = wrapped ? encounter.round + 1 : encounter.round;
    await this.prisma.combatEncounter.update({
      where: { id: encounter.id },
      data: { turnIndex, round, revision: { increment: 1 } },
    });

    await this.broadcast(campaignId, {
      type: 'turn',
      participantId: encounter.participants[turnIndex].id,
      round,
    });
    return this.getEncounter(campaignId, userId);
  }

  /**
   * Ficha -> combate: quando o PV muda fora do combate (ficha, descanso),
   * o participante ligado ao personagem acompanha e a mesa é avisada.
   */
  async syncCharacterHp(characterId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { currentHp: true, maxHp: true },
    });
    if (!character) return;
    const participants = await this.prisma.combatParticipant.findMany({
      where: { characterId },
      include: { encounter: { select: { campaignId: true } } },
    });
    for (const participant of participants) {
      const currentHp = Math.max(
        0,
        Math.min(character.currentHp, character.maxHp),
      );
      if (
        participant.currentHp === currentHp &&
        participant.maxHp === character.maxHp
      ) {
        continue;
      }
      await this.prisma.combatParticipant.update({
        where: { id: participant.id },
        data: { currentHp, maxHp: character.maxHp },
      });
      const delta = currentHp - participant.currentHp;
      await this.broadcast(
        participant.encounter.campaignId,
        delta !== 0
          ? {
              type: 'hp',
              participantId: participant.id,
              delta,
              hpStatus: hpStatus(currentHp, character.maxHp),
            }
          : { type: 'roster' },
      );
    }
  }

  private async getActiveEncounter(campaignId: string) {
    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
    });
    if (!encounter) {
      throw new NotFoundException(
        'Nenhum combate em andamento nesta campanha.',
      );
    }
    return encounter;
  }

  private async getOwnedParticipant(campaignId: string, participantId: string) {
    const encounter = await this.getActiveEncounter(campaignId);
    const participant = await this.prisma.combatParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant || participant.encounterId !== encounter.id) {
      throw new NotFoundException('Participante não encontrado.');
    }

    return participant;
  }

  /**
   * Tempo real (MV-09): o mestre recebe a visão completa e os jogadores a
   * projeção, inclusive no evento (sem dano numérico de inimigo oculto).
   */
  private async broadcast(campaignId: string, event: CombatEvent) {
    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
      include: ENCOUNTER_INCLUDE,
    });
    let playerEvent = event;
    if (event.type === 'hp' && encounter?.hpDisplay === 'DESCRIPTIVE') {
      const target = encounter.participants.find(
        (item) => item.id === event.participantId,
      );
      if (target && !target.isAlly) playerEvent = { ...event, delta: null };
    }
    this.vttGateway.emitCombat(
      campaignId,
      {
        encounter: encounter ? this.serializeEncounter(encounter, true) : null,
        event,
      },
      {
        encounter: encounter ? this.serializeEncounter(encounter, false) : null,
        event: playerEvent,
      },
    );
  }

  /** Jogadores so recebem PV numerico de inimigos no modo NUMERIC. */
  private serializeEncounter(
    encounter: EncounterWithParticipants,
    isMaster: boolean,
  ) {
    return {
      ...encounter,
      participants: encounter.participants.map((participant) => {
        const hidden =
          !isMaster &&
          !participant.isAlly &&
          encounter.hpDisplay === 'DESCRIPTIVE';
        return {
          ...participant,
          currentHp: hidden ? null : participant.currentHp,
          maxHp: hidden ? null : participant.maxHp,
          hpStatus: hpStatus(participant.currentHp, participant.maxHp),
          conditions: parseStringArray(participant.conditions),
        };
      }),
    };
  }

  /** Marca o encontro como alterado (concorrência otimista, P1-2). */
  private async touchEncounter(encounterId: string) {
    await this.prisma.combatEncounter.update({
      where: { id: encounterId },
      data: { revision: { increment: 1 } },
    });
  }

  private async assertIsMember(campaignId: string, userId: string) {
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

  private async assertIsMaster(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Apenas o mestre pode realizar esta ação.');
    }
    return campaign;
  }
}
