import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { parseJson, parseStringArray } from '../common/json';
import { DiceService } from '../dice/dice.service';
import { PrismaService } from '../prisma/prisma.service';
import { CombatService } from './combat.service';
import { DeathSaveDto } from './death-save.dto';
import { resolveDeathSave, type DeathSaveResult } from './death-save.types';

type Tx = Prisma.TransactionClient;

@Injectable()
export class DeathSaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly combat: CombatService,
    private readonly dice: DiceService,
  ) {}

  async roll(campaignId: string, userId: string, dto: DeathSaveDto) {
    const campaign = await this.access.member(campaignId, userId);
    const requestHash = createHash('sha256')
      .update(`death-save:${dto.requestKey}`)
      .digest('hex');
    const previous = await this.prisma.combatAction.findFirst({
      where: { campaignId, actorUserId: userId, requestKey: dto.requestKey },
    });
    if (previous) return this.replay(previous);

    let result: DeathSaveResult;
    let participantId: string;
    try {
      const executed = await this.prisma.$transaction(
        async (tx) =>
          this.execute(
            tx,
            campaignId,
            userId,
            campaign.masterId === userId,
            dto,
            requestHash,
          ),
        { isolationLevel: 'Serializable', timeout: 20_000 },
      );
      result = executed.result;
      participantId = executed.participantId;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replayed = await this.prisma.combatAction.findFirst({
          where: {
            campaignId,
            actorUserId: userId,
            requestKey: dto.requestKey,
          },
        });
        if (replayed) return this.replay(replayed);
      }
      throw error;
    }

    await this.combat.emitAction(campaignId, {
      type: 'death',
      participantId,
      successes: result.successes,
      failures: result.failures,
      outcome: result.outcome,
    });
    return result;
  }

  private async execute(
    tx: Tx,
    campaignId: string,
    userId: string,
    isMaster: boolean,
    dto: DeathSaveDto,
    requestHash: string,
  ): Promise<{ result: DeathSaveResult; participantId: string }> {
    await tx.$queryRaw`SELECT id FROM \`CombatEncounter\` WHERE campaignId = ${campaignId} FOR UPDATE`;
    const encounter = await tx.combatEncounter.findUnique({
      where: { campaignId },
      include: {
        participants: { orderBy: [{ initiative: 'desc' }, { id: 'asc' }] },
      },
    });
    if (!encounter)
      throw new NotFoundException(
        'Nenhum combate em andamento nesta campanha.',
      );
    const participant = encounter.participants[encounter.turnIndex];
    if (!participant)
      throw new NotFoundException('Participante atual não encontrado.');
    if (!isMaster) {
      if (!participant.characterId)
        throw new ForbiddenException('Este turno não é de um jogador.');
      const character = await tx.character.findUnique({
        where: { id: participant.characterId },
        select: { userId: true },
      });
      if (character?.userId !== userId)
        throw new ForbiddenException('Não é o seu turno.');
    }
    if (!participant.characterId)
      throw new BadRequestException(
        'Monstros e NPCs não rolam salvaguarda contra morte.',
      );

    await tx.$queryRaw`SELECT id FROM \`CombatParticipant\` WHERE id = ${participant.id} FOR UPDATE`;
    const locked = await tx.combatParticipant.findUnique({
      where: { id: participant.id },
    });
    if (!locked) throw new NotFoundException('Participante não encontrado.');
    if (locked.isDead)
      throw new ConflictException('Este personagem já está morto.');
    if (locked.currentHp > 0)
      throw new BadRequestException('O personagem não está inconsciente.');
    if (locked.isStable)
      throw new ConflictException(
        'O personagem está estável e não precisa rolar morte.',
      );
    if (locked.deathSaveUsed)
      throw new ConflictException(
        'A salvaguarda contra morte já foi rolada neste turno.',
      );

    const roll = this.dice.parseAndRoll('1d20').total;
    const state = resolveDeathSave(
      roll,
      locked.deathSuccesses,
      locked.deathFailures,
    );
    const conditions = parseStringArray(locked.conditions);
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
    const add = (name: string) => {
      if (!conditions.some((item) => item.toLowerCase() === name.toLowerCase()))
        conditions.push(name);
    };

    let hpAfter = locked.currentHp;
    if (state.revived) {
      hpAfter = 1;
      remove('Inconsciente', 'Estável', 'Morto');
      await tx.character.update({
        where: { id: participant.characterId },
        data: { currentHp: 1 },
      });
    } else if (state.dead) {
      add('Morto');
      remove('Inconsciente', 'Estável');
    } else if (state.stable) {
      add('Inconsciente');
      add('Estável');
    } else {
      add('Inconsciente');
    }

    await tx.combatParticipant.update({
      where: { id: participant.id },
      data: {
        currentHp: hpAfter,
        deathSuccesses: state.successes,
        deathFailures: state.failures,
        isStable: state.stable,
        isDead: state.dead,
        deathSaveUsed: true,
        conditions: conditions.length ? JSON.stringify(conditions) : null,
      },
    });

    await tx.combatEncounter.update({
      where: { id: encounter.id },
      data: { revision: { increment: 1 } },
    });

    const resultData: Omit<DeathSaveResult, 'actionId' | 'createdAt'> = {
      requestKey: dto.requestKey,
      kind: 'DEATH_SAVE',
      target: {
        kind: 'PARTICIPANT',
        id: participant.id,
        name: participant.name,
        characterId: participant.characterId,
      },
      roll,
      successes: state.successes,
      failures: state.failures,
      stable: state.stable,
      dead: state.dead,
      revived: state.revived,
      outcome: state.outcome,
      hpBefore: {
        current: locked.currentHp,
        max: locked.maxHp,
        temp: locked.tempHp,
      },
      hpAfter: {
        current: hpAfter,
        max: locked.maxHp,
        temp: locked.tempHp,
      },
      alreadyApplied: false,
    };

    const action = await tx.combatAction.create({
      data: {
        campaignId,
        encounterId: encounter.id,
        actorUserId: userId,
        requestKey: dto.requestKey,
        requestHash,
        kind: 'DEATH_SAVE',
        targetKind: 'PARTICIPANT',
        targetId: participant.id,
        targetName: participant.name,
        payload: JSON.stringify({ requestKey: dto.requestKey }),
        result: JSON.stringify({
          ...resultData,
          actionId: '',
          createdAt: new Date().toISOString(),
        }),
      },
    });
    const result: DeathSaveResult = {
      ...resultData,
      actionId: action.id,
      createdAt: action.createdAt.toISOString(),
    };
    await tx.combatAction.update({
      where: { id: action.id },
      data: { result: JSON.stringify(result) },
    });

    return { result, participantId: participant.id };
  }

  private replay(action: { id: string; result: string }): DeathSaveResult {
    const parsed = parseJson(action.result);
    if (!parsed || typeof parsed !== 'object')
      throw new ConflictException('Resultado anterior indisponível.');
    return {
      ...(parsed as DeathSaveResult),
      actionId: action.id,
      alreadyApplied: true,
    };
  }
}
