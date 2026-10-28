import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Character, type CombatParticipant } from '@prisma/client';
import { createHash } from 'node:crypto';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { parseJson, parseStringArray } from '../common/json';
import { DiceService } from '../dice/dice.service';
import { PrismaService } from '../prisma/prisma.service';
import { CombatService, hpStatus } from './combat.service';
import { CombatActionDto } from './combat-action.dto';
import {
  addCondition,
  applyDamage,
  applyHeal,
  applyTempHp,
  removeCondition,
  type CombatActionResult,
  type HpSnapshot,
} from './combat-action.types';
import {
  addTimedCondition,
  parseTimedConditions,
  removeTimedCondition,
} from './condition-duration.types';
import { canonical } from '../game-actions/game-action.types';
import type { DamageDefense } from './damage-defense.types';

type Tx = Prisma.TransactionClient;

interface InternalResult {
  public: CombatActionResult;
  participantId: string | null;
  delta: number;
}

@Injectable()
export class CombatActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly combat: CombatService,
    private readonly dice: DiceService,
  ) {}

  async history(campaignId: string, userId: string, take = 20) {
    const campaign = await this.access.member(campaignId, userId);
    const isMaster = campaign.masterId === userId;
    const limit = Math.min(Math.max(Math.trunc(take) || 20, 1), 50);
    const actions = await this.prisma.combatAction.findMany({
      where: {
        campaignId,
        ...(isMaster ? {} : { actorUserId: userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return actions.map((action) => {
      const parsed = parseJson(action.result);
      return {
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        actionId: action.id,
        alreadyApplied: true,
      };
    });
  }

  async apply(campaignId: string, userId: string, dto: CombatActionDto) {
    const campaign = await this.access.member(campaignId, userId);
    this.validateShape(dto);

    const payload = {
      kind: dto.kind,
      targetKind: dto.targetKind,
      targetId: dto.targetId,
      amount: dto.amount ?? null,
      formula: dto.formula ?? null,
      damageType: dto.damageType ?? null,
      condition: dto.condition ?? null,
      conditionMode: dto.conditionMode ?? null,
      source: dto.source?.trim() || null,
      expectedRevision: dto.expectedRevision ?? null,
    };
    const requestHash = createHash('sha256')
      .update(canonical(payload))
      .digest('hex');

    const previous = await this.findPrevious(
      campaignId,
      userId,
      dto.requestKey,
    );
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new ConflictException(
          'Esta chave de ação já foi usada com outro conteúdo.',
        );
      return this.replay(previous);
    }

    let result: InternalResult;
    try {
      result = await this.prisma.$transaction(
        async (tx) =>
          this.execute(tx, {
            campaignId,
            userId,
            isMaster: campaign.masterId === userId,
            dto,
            requestHash,
            payload,
          }),
        { isolationLevel: 'Serializable', timeout: 20_000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replayed = await this.findPrevious(
          campaignId,
          userId,
          dto.requestKey,
        );
        if (replayed) return this.replay(replayed);
      }
      throw error;
    }

    if (result.participantId) {
      if (dto.kind === 'CONDITION') {
        await this.combat.emitAction(campaignId, {
          type: 'conditions',
          participantId: result.participantId,
        });
      } else {
        const after = result.public.hpAfter;
        await this.combat.emitAction(campaignId, {
          type: 'hp',
          participantId: result.participantId,
          delta: result.delta,
          hpStatus: after ? hpStatus(after.current, after.max) : hpStatus(0, 1),
        });
      }
    }

    return result.public;
  }

  private async execute(
    tx: Tx,
    input: {
      campaignId: string;
      userId: string;
      isMaster: boolean;
      dto: CombatActionDto;
      requestHash: string;
      payload: Record<string, unknown>;
    },
  ): Promise<InternalResult> {
    const { campaignId, userId, isMaster, dto } = input;
    const encounter = await tx.combatEncounter.findUnique({
      where: { campaignId },
    });

    let participant: CombatParticipant | null = null;
    let character: Character | null = null;

    if (dto.targetKind === 'PARTICIPANT') {
      if (!encounter)
        throw new NotFoundException(
          'Nenhum combate em andamento nesta campanha.',
        );
      participant = await tx.combatParticipant.findUnique({
        where: { id: dto.targetId },
      });
      if (!participant || participant.encounterId !== encounter.id)
        throw new NotFoundException('Participante não encontrado.');
      if (participant.characterId) {
        character = await tx.character.findUnique({
          where: { id: participant.characterId },
        });
      }
      if (!isMaster && character?.userId !== userId)
        throw new ForbiddenException(
          'Você só pode alterar o seu próprio personagem.',
        );
    } else {
      const binding = await tx.campaignCharacter.findFirst({
        where: { campaignId, characterId: dto.targetId },
        include: { character: true },
      });
      if (!binding) throw new NotFoundException('Personagem não encontrado.');
      character = binding.character;
      if (!isMaster && character.userId !== userId)
        throw new ForbiddenException(
          'Você só pode alterar o seu próprio personagem.',
        );
      if (encounter) {
        participant = await tx.combatParticipant.findFirst({
          where: { encounterId: encounter.id, characterId: character.id },
        });
      }
    }

    if (dto.kind === 'CONDITION' && !participant)
      throw new BadRequestException(
        'Condições exigem um participante de combate ativo.',
      );

    // Travamento determinístico: ficha antes do participante.
    if (character) {
      await tx.$queryRaw`SELECT id FROM \`character\` WHERE id = ${character.id} FOR UPDATE`;
      character = await tx.character.findUnique({
        where: { id: character.id },
      });
    }
    if (participant) {
      await tx.$queryRaw`SELECT id FROM \`combatparticipant\` WHERE id = ${participant.id} FOR UPDATE`;
      participant = await tx.combatParticipant.findUnique({
        where: { id: participant.id },
      });
    }
    if (!character && !participant)
      throw new NotFoundException('Alvo não encontrado.');

    if (
      encounter &&
      dto.expectedRevision !== undefined &&
      dto.expectedRevision !== encounter.revision
    ) {
      throw new ConflictException(
        'O combate mudou. Recarregue antes de aplicar a ação.',
      );
    }

    const hpBefore: HpSnapshot = participant
      ? {
          current: participant.currentHp,
          max: participant.maxHp,
          temp: participant.tempHp,
        }
      : {
          current: character!.currentHp,
          max: character!.maxHp,
          temp: character!.tempHp,
        };
    const conditionsBefore = participant
      ? parseStringArray(participant.conditions)
      : [];
    const timersBefore = participant
      ? parseTimedConditions(participant.timedConditions)
      : [];

    let hpAfter = hpBefore;
    let conditionsAfter = conditionsBefore;
    let timersAfter = timersBefore;
    let amount = 0;
    let breakdown: CombatActionResult['breakdown'] = null;
    let applied = 0;
    let absorbedByTempHp = 0;
    let defense: DamageDefense | null = null;

    if (dto.kind === 'DAMAGE' || dto.kind === 'HEAL') {
      if (dto.formula) {
        breakdown = this.dice.parseAndRoll(dto.formula);
        amount = Math.max(0, breakdown.total);
      } else {
        amount = dto.amount ?? 0;
      }
    } else if (dto.kind === 'TEMP_HP') {
      amount = dto.amount ?? 0;
    }

    if (dto.kind === 'DAMAGE') {
      defense = await this.combat.resolveDamageDefense(
        tx,
        character?.id ?? null,
        dto.damageType,
        amount,
        participant?.id,
      );
      amount = defense.adjusted;
    }

    if (dto.kind === 'DAMAGE') {
      const result = applyDamage(hpBefore, amount);
      hpAfter = result.hp;
      applied = result.applied;
      absorbedByTempHp = result.absorbedByTempHp;
    } else if (dto.kind === 'HEAL') {
      hpAfter = applyHeal(hpBefore, amount);
      applied = hpAfter.current - hpBefore.current;
    } else if (dto.kind === 'TEMP_HP') {
      hpAfter = applyTempHp(hpBefore, amount);
      applied = hpAfter.temp - hpBefore.temp;
    } else {
      const condition = dto.condition ?? '';
      try {
        conditionsAfter =
          dto.conditionMode === 'REMOVE'
            ? removeCondition(conditionsBefore, condition)
            : addCondition(conditionsBefore, condition);
        timersAfter =
          dto.conditionMode === 'REMOVE'
            ? removeTimedCondition(timersBefore, condition)
            : dto.durationRounds
              ? addTimedCondition(
                  timersBefore,
                  condition,
                  dto.durationRounds,
                  dto.source ?? null,
                )
              : removeTimedCondition(timersBefore, condition);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Condição inválida.',
        );
      }
    }

    const participantUpdate =
      participant && (dto.kind === 'CONDITION' || hpAfter !== hpBefore);
    if (participant && participantUpdate) {
      await tx.combatParticipant.update({
        where: { id: participant.id },
        data: {
          currentHp: hpAfter.current,
          tempHp: hpAfter.temp,
          ...(dto.kind === 'CONDITION'
            ? {
                conditions: conditionsAfter.length
                  ? JSON.stringify(conditionsAfter)
                  : null,
                timedConditions: timersAfter.length
                  ? JSON.stringify(timersAfter)
                  : null,
              }
            : {}),
        },
      });
    }

    if (character && (dto.kind !== 'CONDITION' || participant)) {
      await tx.character.update({
        where: { id: character.id },
        data: {
          currentHp: Math.min(hpAfter.current, character.maxHp),
          ...(dto.kind === 'CONDITION' ? {} : { tempHp: hpAfter.temp }),
        },
      });
    }

    if (participant) {
      await this.combat.reconcileVitals(
        tx,
        participant.id,
        dto.kind === 'DAMAGE' && hpBefore.current === 0 && applied > 0,
      );
    }
    if (dto.kind === 'DAMAGE' && applied > 0 && character) {
      await this.combat.breakConcentrationOnDamage(tx, character.id, applied);
    }

    if (encounter) {
      if (dto.expectedRevision !== undefined) {
        const claimed = await tx.combatEncounter.updateMany({
          where: { id: encounter.id, revision: dto.expectedRevision },
          data: { revision: { increment: 1 } },
        });
        if (claimed.count === 0)
          throw new ConflictException(
            'O combate mudou. Recarregue antes de aplicar a ação.',
          );
      } else {
        await tx.combatEncounter.update({
          where: { id: encounter.id },
          data: { revision: { increment: 1 } },
        });
      }
    }

    const targetName = participant?.name ?? character!.name;
    const targetCharacterId = participant?.characterId ?? character?.id ?? null;
    const createdAt = new Date();
    const resultData: Omit<CombatActionResult, 'actionId' | 'createdAt'> = {
      requestKey: dto.requestKey,
      kind: dto.kind,
      target: {
        kind: dto.targetKind,
        id: dto.targetId,
        name: targetName,
        characterId: targetCharacterId,
      },
      amount,
      breakdown,
      damageType: dto.damageType ?? null,
      hpBefore: dto.kind === 'CONDITION' ? null : hpBefore,
      hpAfter: dto.kind === 'CONDITION' ? null : hpAfter,
      applied,
      absorbedByTempHp,
      defense,
      conditionsBefore,
      conditionsAfter,
      durationRounds:
        dto.kind === 'CONDITION' && dto.conditionMode !== 'REMOVE'
          ? (dto.durationRounds ?? null)
          : null,
      remainingRounds:
        dto.kind === 'CONDITION'
          ? (timersAfter.find(
              (item) =>
                item.name.toLowerCase() ===
                (dto.condition ?? '').trim().toLowerCase(),
            )?.remainingRounds ?? null)
          : null,
      source: input.payload.source as string | null,
      alreadyApplied: false,
    };

    const action = await tx.combatAction.create({
      data: {
        campaignId,
        encounterId: encounter?.id ?? null,
        actorUserId: userId,
        requestKey: dto.requestKey,
        requestHash: input.requestHash,
        kind: dto.kind,
        targetKind: dto.targetKind,
        targetId: dto.targetId,
        targetName,
        payload: JSON.stringify(input.payload),
        result: JSON.stringify({
          ...resultData,
          actionId: '',
          createdAt: createdAt.toISOString(),
        }),
      },
    });
    const publicResult: CombatActionResult = {
      ...resultData,
      actionId: action.id,
      createdAt: action.createdAt.toISOString(),
    };
    await tx.combatAction.update({
      where: { id: action.id },
      data: { result: JSON.stringify(publicResult) },
    });

    return {
      public: publicResult,
      participantId: participant?.id ?? null,
      delta: hpAfter.current - hpBefore.current,
    };
  }

  private validateShape(dto: CombatActionDto) {
    if (dto.kind === 'DAMAGE' || dto.kind === 'HEAL') {
      if ((dto.amount === undefined) === (dto.formula === undefined))
        throw new BadRequestException(
          'Informe exatamente um valor ou uma fórmula.',
        );
    }
    if (dto.kind === 'TEMP_HP' && dto.amount === undefined)
      throw new BadRequestException('Informe o PV temporário.');
    if (dto.kind === 'CONDITION') {
      if (!dto.condition || !dto.conditionMode)
        throw new BadRequestException(
          'Informe a condição e se ela é adicionada ou removida.',
        );
      if (dto.amount !== undefined || dto.formula !== undefined)
        throw new BadRequestException(
          'Condições não usam valor ou fórmula de dano.',
        );
    }
    if (dto.kind !== 'DAMAGE' && dto.damageType && dto.damageType !== 'untyped')
      throw new BadRequestException('Tipo de dano só se aplica a dano.');
  }

  private findPrevious(campaignId: string, userId: string, requestKey: string) {
    return this.prisma.combatAction.findFirst({
      where: { campaignId, actorUserId: userId, requestKey },
    });
  }

  private replay(action: { id: string; result: string }): CombatActionResult {
    const parsed = parseJson(action.result);
    if (!parsed || typeof parsed !== 'object')
      throw new ConflictException('Resultado anterior indisponível.');
    return {
      ...(parsed as CombatActionResult),
      actionId: action.id,
      alreadyApplied: true,
    };
  }
}
