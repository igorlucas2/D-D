import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
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
import {
  parseTimedConditions,
  tickTimedConditions,
} from './condition-duration.types';
import {
  parseDamageDefenses,
  resolveDamageDefense,
  type DamageDefense,
  type ResistanceEntry,
} from './damage-defense.types';
import { StartEncounterDto } from './dto/start-encounter.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { MoveCombatParticipantDto } from './dto/move-combat-participant.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';

const PARTICIPANT_ORDER: Prisma.CombatParticipantOrderByWithRelationInput[] = [
  { initiative: 'desc' },
  { id: 'asc' },
];

function normalizedCondition(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

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
        damageDefenses: dto.damageDefenses?.length
          ? JSON.stringify(dto.damageDefenses)
          : null,
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
    if (dto.damageDefenses !== undefined) {
      data.damageDefenses = dto.damageDefenses.length
        ? JSON.stringify(dto.damageDefenses)
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

  async moveParticipant(
    campaignId: string,
    userId: string,
    participantId: string,
    dto: MoveCombatParticipantDto,
  ) {
    const campaign = await this.assertIsMember(campaignId, userId);
    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
      include: ENCOUNTER_INCLUDE,
    });
    if (!encounter) {
      throw new NotFoundException(
        'Nenhum combate em andamento nesta campanha.',
      );
    }
    const participant = encounter.participants.find(
      (entry) => entry.id === participantId,
    );
    if (!participant) {
      throw new NotFoundException('Participante não encontrado.');
    }
    if (participant.isDead) {
      throw new ConflictException('Um participante morto não se move.');
    }

    const current = encounter.participants[encounter.turnIndex];
    if (campaign.masterId !== userId) {
      if (current?.id !== participant.id) {
        throw new ConflictException('Não é o turno deste participante.');
      }
      if (!participant.characterId) {
        throw new ConflictException(
          'Este turno não pertence a um personagem jogável.',
        );
      }
      const character = await this.prisma.character.findUnique({
        where: { id: participant.characterId },
        select: { userId: true },
      });
      if (character?.userId !== userId) {
        throw new ConflictException(
          'Não é o seu turno. Aguarde ou peça ao mestre.',
        );
      }
    }

    const fromX = participant.x ?? 0;
    const fromY = participant.y ?? 0;
    // Participantes antigos entram sem coordenada: o primeiro movimento é a
    // colocação inicial no grid, sem custo de deslocamento.
    const placing = participant.x == null || participant.y == null;
    const cells = placing
      ? 0
      : Math.max(Math.abs(dto.x - fromX), Math.abs(dto.y - fromY));
    const feet = cells * 5;
    const remaining = participant.speed - participant.movementUsed;
    if (feet > remaining) {
      throw new BadRequestException(
        `Movimento insuficiente: restam ${remaining} pés e o deslocamento custa ${feet}.`,
      );
    }

    await this.prisma.combatParticipant.update({
      where: { id: participant.id },
      data: {
        x: dto.x,
        y: dto.y,
        movementUsed: participant.movementUsed + feet,
      },
    });
    await this.touchEncounter(participant.encounterId);
    return this.getEncounter(campaignId, userId);
  }

  async aiTurn(campaignId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
      include: ENCOUNTER_INCLUDE,
    });
    if (!encounter) {
      throw new NotFoundException('Nenhum combate em andamento.');
    }
    const current = encounter.participants[encounter.turnIndex];
    if (!current) throw new BadRequestException('Turno sem participante.');
    if (current.isAlly) {
      throw new ConflictException(
        'O turno atual é de um aliado; a IA só age em inimigos.',
      );
    }

    const allies = encounter.participants.filter(
      (participant) =>
        participant.isAlly && !participant.isDead && participant.currentHp > 0,
    );
    if (!allies.length) {
      throw new ConflictException('Não há aliados válidos para a IA atacar.');
    }
    const target = [...allies].sort((left, right) => {
      if (
        current.x == null ||
        current.y == null ||
        left.x == null ||
        left.y == null
      ) {
        return left.id.localeCompare(right.id);
      }
      const distance = (entry: (typeof allies)[number]) =>
        Math.max(
          Math.abs(current.x! - (entry.x ?? current.x!)),
          Math.abs(current.y! - (entry.y ?? current.y!)),
        );
      return distance(left) - distance(right);
    })[0];

    let x = current.x;
    let y = current.y;
    let movementUsed = current.movementUsed;
    if (x != null && y != null && target.x != null && target.y != null) {
      const remainingCells = Math.max(
        0,
        Math.floor((current.speed - movementUsed) / 5),
      );
      const dx = Math.sign(target.x - x);
      const dy = Math.sign(target.y - y);
      const cells = Math.min(
        remainingCells,
        Math.max(Math.abs(target.x - x), Math.abs(target.y - y)) - 1,
      );
      if (cells > 0) {
        x += dx * cells;
        y += dy * cells;
        movementUsed += cells * 5;
      }
    }

    let damage = 0;
    let hit = false;
    let critical = false;
    let attackRollTotal = 0;
    let ac = 10;
    const distance =
      x != null && y != null && target.x != null && target.y != null
        ? Math.max(Math.abs(target.x - x), Math.abs(target.y - y))
        : 0;
    const canAttack = distance <= 1 && !current.actionUsed;
    if (canAttack) {
      const targetCharacter = target.characterId
        ? await this.prisma.character.findUnique({
            where: { id: target.characterId },
            select: { armorClass: true },
          })
        : null;
      ac = targetCharacter?.armorClass ?? 10;
      const attack = this.dice.parseAndRoll('1d20');
      attackRollTotal = attack.total;
      critical = attack.total === 20;
      hit = attack.total !== 1 && (critical || attack.total + 2 >= ac);
      if (hit) {
        const rollDamage = this.dice.parseAndRoll('1d6+1').total;
        damage = critical ? rollDamage * 2 : rollDamage;
      }
    }

    await this.prisma.combatParticipant.update({
      where: { id: current.id },
      data: {
        x,
        y,
        movementUsed,
        actionUsed: current.actionUsed || canAttack,
      },
    });

    const hpBefore = {
      current: target.currentHp,
      max: target.maxHp,
      temp: target.tempHp,
    };
    let applied = 0;
    if (hit && damage > 0) {
      const absorbed = Math.min(target.tempHp, damage);
      applied = damage - absorbed;
      const nextHp = Math.max(0, target.currentHp - applied);
      await this.prisma.combatParticipant.update({
        where: { id: target.id },
        data: {
          tempHp: target.tempHp - absorbed,
          currentHp: nextHp,
        },
      });
      await this.emitAction(campaignId, {
        type: 'hp',
        participantId: target.id,
        delta: nextHp - target.currentHp,
        hpStatus: hpStatus(nextHp, target.maxHp),
      });
    }

    if (canAttack) {
      const requestKey = randomUUID();
      const payload = {
        currentId: current.id,
        currentName: current.name,
        targetId: target.id,
        attack: attackRollTotal,
        ac,
        hit,
        critical,
        damage,
      };
      await this.prisma.combatAction.create({
        data: {
          campaignId,
          encounterId: encounter.id,
          actorUserId: userId,
          requestKey,
          requestHash: createHash('sha256')
            .update(JSON.stringify(payload))
            .digest('hex'),
          kind: 'AI_ATTACK',
          targetKind: 'PARTICIPANT',
          targetId: target.id,
          targetName: target.name,
          payload: JSON.stringify(payload),
          result: JSON.stringify({
            kind: 'AI_ATTACK',
            target: {
              kind: 'PARTICIPANT',
              id: target.id,
              name: target.name,
              characterId: target.characterId,
            },
            amount: damage,
            applied,
            hpBefore,
            hpAfter: {
              current: target.currentHp - applied,
              max: target.maxHp,
              temp: target.tempHp - Math.min(target.tempHp, damage),
            },
            source: `IA: ${current.name}`,
            damageType: 'slashing',
            conditionsBefore: [],
            conditionsAfter: [],
          }),
        },
      });
    }

    await this.touchEncounter(encounter.id);
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
    actionType: 'ACTION' | 'BONUS' | 'REACTION' = 'ACTION',
  ): Promise<{
    participantId: string;
    actionType: 'ACTION' | 'BONUS' | 'REACTION';
  } | null> {
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
    if (actionType === 'BONUS' && participant.bonusUsed) {
      throw new ConflictException('Sua ação bônus já foi usada neste turno.');
    }
    if (actionType === 'REACTION' && participant.reactionUsed) {
      throw new ConflictException('Sua reação já foi usada neste turno.');
    }
    if (actionType === 'ACTION' && participant.actionUsed) {
      throw new ConflictException(
        'Sua ação já foi usada neste turno. Encerre o turno.',
      );
    }
    return { participantId: participant.id, actionType };
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

  async consumeBonus(tx: Prisma.TransactionClient, participantId: string) {
    await tx.combatParticipant.update({
      where: { id: participantId },
      data: { bonusUsed: true },
    });
  }

  async consumeReaction(tx: Prisma.TransactionClient, participantId: string) {
    await tx.combatParticipant.update({
      where: { id: participantId },
      data: { reactionUsed: true },
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
    if (state) {
      for (const target of state.targets) {
        if (target.kind !== 'PARTICIPANT') continue;
        const participant = await tx.combatParticipant.findUnique({
          where: { id: target.id },
          select: { id: true, conditions: true },
        });
        if (!participant) continue;
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

  async attackRollBonus(
    tx: Prisma.TransactionClient,
    campaignId: string,
    characterId: string,
  ): Promise<string | null> {
    const participant = await tx.combatParticipant.findFirst({
      where: { encounter: { campaignId }, characterId },
      select: { conditions: true },
    });
    if (!participant) return null;
    return parseStringArray(participant.conditions).some(
      (item) => normalizedCondition(item) === 'abencoado',
    )
      ? '1d4'
      : null;
  }

  async conditionAcBonus(
    tx: Prisma.TransactionClient,
    participantId: string,
  ): Promise<number> {
    const participant = await tx.combatParticipant.findUnique({
      where: { id: participantId },
      select: { conditions: true },
    });
    if (!participant) return 0;
    const conditions = parseStringArray(participant.conditions);
    let bonus = 0;
    if (conditions.some((item) => normalizedCondition(item) === 'protegido'))
      bonus += 2;
    if (conditions.some((item) => normalizedCondition(item) === 'escudado'))
      bonus += 5;
    return bonus;
  }

  async resolveDamageDefense(
    tx: Prisma.TransactionClient,
    characterId: string | null,
    damageType: string | null | undefined,
    amount: number,
    participantId?: string | null,
  ): Promise<DamageDefense> {
    const entries: ResistanceEntry[] = [];
    if (participantId) {
      const participant = await tx.combatParticipant.findUnique({
        where: { id: participantId },
        select: { damageDefenses: true },
      });
      entries.push(...parseDamageDefenses(participant?.damageDefenses));
    }
    if (characterId) {
      entries.push(
        ...(await tx.characterResistance.findMany({
          where: { characterId },
          select: { damageType: true, type: true },
        })),
      );
    }
    return resolveDamageDefense(amount, damageType, entries);
  }

  async saveRollBonus(
    tx: Prisma.TransactionClient,
    participantId: string,
  ): Promise<string | null> {
    const participant = await tx.combatParticipant.findUnique({
      where: { id: participantId },
      select: { conditions: true },
    });
    if (!participant) return null;
    return parseStringArray(participant.conditions).some(
      (item) => normalizedCondition(item) === 'abencoado',
    )
      ? '1d4'
      : null;
  }

  async concentrationBonus(
    tx: Prisma.TransactionClient,
    characterId: string,
    targetKind: 'CHARACTER' | 'PARTICIPANT',
    targetId: string,
  ): Promise<string | null> {
    const state = await this.getConcentration(tx, characterId);
    if (!state || normalizedCondition(state.condition) !== 'marcado')
      return null;
    return state.targets.some(
      (target) => target.kind === targetKind && target.id === targetId,
    )
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
      await this.tickConditionDurations(tx, next.id);
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
          movementUsed: 0,
        },
      });
    });

    await this.broadcast(campaignId, {
      type: 'turn',
      participantId: next.id,
      round,
    });
  }

  private async tickConditionDurations(
    tx: Prisma.TransactionClient,
    participantId: string,
  ) {
    const participant = await tx.combatParticipant.findUnique({
      where: { id: participantId },
      select: { conditions: true, timedConditions: true },
    });
    if (!participant) return;
    const timers = parseTimedConditions(participant.timedConditions);
    if (!timers.length) return;
    const { remaining, expired } = tickTimedConditions(timers);
    const conditions = parseStringArray(participant.conditions).filter(
      (condition) =>
        !expired.some(
          (name) =>
            normalizedCondition(condition) === normalizedCondition(name),
        ),
    );
    await tx.combatParticipant.update({
      where: { id: participantId },
      data: {
        conditions: conditions.length ? JSON.stringify(conditions) : null,
        timedConditions: remaining.length ? JSON.stringify(remaining) : null,
      },
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
