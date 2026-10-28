import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseStringArray } from '../common/json';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { DiceService } from '../dice/dice.service';
import { PrismaService } from '../prisma/prisma.service';
import { VttGateway } from '../vtt/vtt.gateway';
import {
  parseConcentrationState,
  type ConcentrationState,
} from './concentration.types';
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
      type: 'death';
      participantId: string;
      successes: number;
      failures: number;
      outcome: string;
    }
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
    private readonly access: CampaignAccessService,
    private readonly vttGateway: VttGateway,
    private readonly dice: DiceService,
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
    await this.advanceTurn(campaignId, encounter);
    return this.getEncounter(campaignId, userId);
  }

  /** Jogador atual encerra o próprio turno; mestre pode encerrar qualquer um. */
  async endTurn(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
      include: ENCOUNTER_INCLUDE,
    });
    if (!encounter)
      throw new NotFoundException(
        'Nenhum combate em andamento nesta campanha.',
      );
    if (encounter.participants.length === 0)
      throw new BadRequestException(
        'Adicione participantes antes de encerrar o turno.',
      );
    const current = encounter.participants[encounter.turnIndex];
    if (campaign.masterId !== userId) {
      if (!current?.characterId)
        throw new ConflictException(
          'Este turno não pertence a um personagem jogável.',
        );
      const character = await this.prisma.character.findUnique({
        where: { id: current.characterId },
        select: { userId: true },
      });
      if (character?.userId !== userId)
        throw new ConflictException(
          'Não é o seu turno. Aguarde ou peça ao mestre.',
        );
    }
    await this.advanceTurn(campaignId, encounter);
    return this.getEncounter(campaignId, userId);
  }

  /**
   * Verifica se o personagem pode gastar a ação no combate atual.
   * Fora de combate retorna null. Mestre sem participante também não entra na
   * economia (útil para ajustes), mas quem tem participante segue a ordem.
   */
  async assertCanAct(
    tx: Prisma.TransactionClient,
    campaignId: string,
    characterId: string,
    isMaster: boolean,
  ): Promise<{ participantId: string } | null> {
    await tx.$queryRaw`SELECT id FROM \`CombatEncounter\` WHERE campaignId = ${campaignId} FOR UPDATE`;
    const encounter = await tx.combatEncounter.findUnique({
      where: { campaignId },
      include: ENCOUNTER_INCLUDE,
    });
    if (!encounter) return null;
    const participant = encounter.participants.find(
      (item) => item.characterId === characterId,
    );
    if (!participant) {
      if (isMaster) return null;
      throw new BadRequestException(
        'Seu personagem não está no combate ativo.',
      );
    }
    const current = encounter.participants[encounter.turnIndex];
    if (current?.id !== participant.id) {
      throw new ConflictException(
        'Não é o seu turno. Aguarde ou peça ao mestre para avançar.',
      );
    }
    if (participant.isDead) {
      throw new ConflictException('Este personagem está morto.');
    }
    if (participant.currentHp <= 0) {
      throw new ConflictException(
        'Personagem inconsciente: role a salvaguarda contra morte ou receba cura.',
      );
    }
    if (participant.actionUsed) {
      throw new ConflictException(
        'Sua ação já foi usada neste turno. Encerre o turno.',
      );
    }
    return { participantId: participant.id };
  }

  /**
   * Normaliza o estado de vida depois de dano/cura em um participante.
   * Personagens a 0 PV ficam inconscientes e passam a rolar morte; monstros
   * caem mortos. Cura acima de 0 limpa os estados de morte.
   */
  async reconcileVitals(
    tx: Prisma.TransactionClient,
    participantId: string,
    damageAtZero = false,
  ) {
    const participant = await tx.combatParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant) return;
    const conditions = parseStringArray(participant.conditions);
    const exists = (name: string) =>
      conditions.some((item) => item.toLowerCase() === name.toLowerCase());
    const add = (name: string) => {
      if (!exists(name)) conditions.push(name);
    };
    const remove = (...names: string[]) => {
      for (let index = conditions.length - 1; index >= 0; index--) {
        if (
          names.some(
            (name) => conditions[index].toLowerCase() === name.toLowerCase(),
          )
        )
          conditions.splice(index, 1);
      }
    };

    let isDead = participant.isDead;
    let isStable = participant.isStable;
    let successes = participant.deathSuccesses;
    let failures = participant.deathFailures;

    if (participant.currentHp > 0) {
      isDead = false;
      isStable = false;
      successes = 0;
      failures = 0;
      remove('Inconsciente', 'Estável', 'Morto');
    } else if (!participant.characterId) {
      isDead = true;
      isStable = false;
      add('Morto');
      remove('Inconsciente', 'Estável');
    } else if (isDead) {
      add('Morto');
    } else {
      add('Inconsciente');
      if (isStable) {
        add('Estável');
      } else if (damageAtZero) {
        isStable = false;
        failures = Math.min(3, failures + 1);
        if (failures >= 3) {
          isDead = true;
          add('Morto');
          remove('Inconsciente', 'Estável');
        }
      }
    }

    await tx.combatParticipant.update({
      where: { id: participant.id },
      data: {
        isDead,
        isStable,
        deathSuccesses: successes,
        deathFailures: failures,
        deathSaveUsed:
          participant.currentHp > 0 ? false : participant.deathSaveUsed,
        conditions: conditions.length ? JSON.stringify(conditions) : null,
      },
    });
  }

  async consumeAction(tx: Prisma.TransactionClient, participantId: string) {
    await tx.combatParticipant.update({
      where: { id: participantId },
      data: { actionUsed: true },
    });
  }

  async getConcentration(
    tx: Prisma.TransactionClient,
    characterId: string,
  ): Promise<ConcentrationState | null> {
    const character = await tx.character.findUnique({
      where: { id: characterId },
      select: { concentration: true },
    });
    const state = parseConcentrationState(character?.concentration);
    if (!state) return null;
    if (Date.parse(state.expiresAt) <= Date.now()) {
      await this.clearConcentration(tx, characterId);
      return null;
    }
    return state;
  }

  async setConcentration(
    tx: Prisma.TransactionClient,
    characterId: string,
    state: ConcentrationState,
  ) {
    await this.clearConcentration(tx, characterId);
    await tx.character.update({
      where: { id: characterId },
      data: { concentration: JSON.stringify(state) },
    });
  }

  async clearConcentration(tx: Prisma.TransactionClient, characterId: string) {
    const character = await tx.character.findUnique({
      where: { id: characterId },
      select: { concentration: true },
    });
    const state = parseConcentrationState(character?.concentration);
    if (state?.targetKind === 'PARTICIPANT') {
      const participant = await tx.combatParticipant.findUnique({
        where: { id: state.targetId },
        select: { id: true, conditions: true },
      });
      if (participant) {
        const conditions = parseStringArray(participant.conditions).filter(
          (item) => item.toLowerCase() !== state.condition.toLowerCase(),
        );
        await tx.combatParticipant.update({
          where: { id: participant.id },
          data: {
            conditions: conditions.length ? JSON.stringify(conditions) : null,
          },
        });
      }
    }
    if (character?.concentration) {
      await tx.character.update({
        where: { id: characterId },
        data: { concentration: null },
      });
    }
  }

  async endConcentration(
    campaignId: string,
    userId: string,
    characterId: string,
  ) {
    const campaign = await this.access.member(campaignId, userId);
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true, concentration: true },
    });
    if (!character) throw new NotFoundException('Personagem não encontrado.');
    if (campaign.masterId !== userId && character.userId !== userId)
      throw new ForbiddenException(
        'Você só pode encerrar a concentração do seu personagem.',
      );
    await this.prisma.$transaction((tx) =>
      this.clearConcentration(tx, characterId),
    );
    return { ended: Boolean(character.concentration) };
  }

  async concentrationBonus(
    tx: Prisma.TransactionClient,
    characterId: string,
    targetKind: 'CHARACTER' | 'PARTICIPANT',
    targetId: string,
  ): Promise<string | null> {
    const state = await this.getConcentration(tx, characterId);
    return state &&
      state.targetKind === targetKind &&
      state.targetId === targetId
      ? state.bonusFormula
      : null;
  }

  async breakConcentrationOnDamage(
    tx: Prisma.TransactionClient,
    characterId: string,
    damage: number,
  ): Promise<boolean> {
    const state = await this.getConcentration(tx, characterId);
    if (!state || damage <= 0) return false;
    const character = await tx.character.findUnique({
      where: { id: characterId },
      select: { constitution: true },
    });
    if (!character) return false;
    const roll = this.dice.parseAndRoll('1d20').total;
    const modifier = Math.floor((character.constitution - 10) / 2);
    const dc = Math.max(10, Math.floor(damage / 2));
    if (roll + modifier >= dc) return false;
    await this.clearConcentration(tx, characterId);
    return true;
  }

  private async advanceTurn(
    campaignId: string,
    encounter: EncounterWithParticipants,
  ) {
    const nextIndex = encounter.turnIndex + 1;
    const wrapped = nextIndex >= encounter.participants.length;
    const turnIndex = wrapped ? 0 : nextIndex;
    const round = wrapped ? encounter.round + 1 : encounter.round;
    const next = encounter.participants[turnIndex];

    await this.prisma.$transaction(async (tx) => {
      await tx.combatEncounter.update({
        where: { id: encounter.id },
        data: { turnIndex, round, revision: { increment: 1 } },
      });
      await tx.combatParticipant.update({
        where: { id: next.id },
        data: {
          actionUsed: false,
          bonusUsed: false,
          reactionUsed: false,
          deathSaveUsed: false,
        },
      });
    });

    await this.broadcast(campaignId, {
      type: 'turn',
      participantId: next.id,
      round,
    });
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

  /**
   * Entrada pública para o motor de ações emitir hp/condições sem duplicar a
   * lógica de projeção por papel (mestre x jogador).
   */
  async emitAction(campaignId: string, event: CombatEvent) {
    await this.broadcast(campaignId, event);
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
    return this.access.member(campaignId, userId);
  }

  private async assertIsMaster(campaignId: string, userId: string) {
    return this.access.master(campaignId, userId);
  }
}
