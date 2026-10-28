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
import { parseJson } from '../common/json';
import { DiceService } from '../dice/dice.service';
import { PrismaService } from '../prisma/prisma.service';
import { CombatService, hpStatus } from './combat.service';
import type { DamageDefense } from './damage-defense.types';
import {
  applyDamage,
  applyHeal,
  applyTempHp,
  type HpSnapshot,
} from './combat-action.types';
import { canonical } from '../game-actions/game-action.types';
import { UseItemDto } from './item-use.dto';
import { parseItemEffect, type ItemUseResult } from './item-use.types';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ItemUseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly combat: CombatService,
    private readonly dice: DiceService,
  ) {}

  async use(campaignId: string, userId: string, dto: UseItemDto) {
    const campaign = await this.access.member(campaignId, userId);
    const requestHash = createHash('sha256')
      .update(
        canonical({
          inventoryItemId: dto.inventoryItemId,
          characterId: dto.characterId,
          expectedRevision: dto.expectedRevision ?? null,
        }),
      )
      .digest('hex');

    const previous = await this.findPrevious(
      campaignId,
      userId,
      dto.requestKey,
    );
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new ConflictException(
          'Esta chave de uso já foi usada com outro conteúdo.',
        );
      return this.replay(previous);
    }

    let result: ItemUseResult;
    let participantId: string | null = null;
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
        const replayed = await this.findPrevious(
          campaignId,
          userId,
          dto.requestKey,
        );
        if (replayed) return this.replay(replayed);
      }
      throw error;
    }

    if (participantId) {
      await this.combat.emitAction(campaignId, {
        type: 'hp',
        participantId,
        delta: result.hpAfter.current - result.hpBefore.current,
        hpStatus: hpStatus(result.hpAfter.current, result.hpAfter.max),
      });
    }
    return result;
  }

  private async execute(
    tx: Tx,
    campaignId: string,
    userId: string,
    isMaster: boolean,
    dto: UseItemDto,
    requestHash: string,
  ): Promise<{ result: ItemUseResult; participantId: string | null }> {
    await tx.$queryRaw`SELECT id FROM \`InventoryItem\` WHERE id = ${dto.inventoryItemId} FOR UPDATE`;
    const inventory = await tx.inventoryItem.findUnique({
      where: { id: dto.inventoryItemId },
      include: { item: true },
    });
    if (!inventory || inventory.characterId !== dto.characterId)
      throw new NotFoundException('Item do personagem não encontrado.');
    if (inventory.quantity < 1)
      throw new BadRequestException('Este item não tem quantidade disponível.');

    let character: Character | null = await tx.character.findUnique({
      where: { id: dto.characterId },
    });
    if (!character || character.userId !== userId)
      throw new ForbiddenException(
        'Você só pode usar itens do seu próprio personagem.',
      );
    const binding = await tx.campaignCharacter.findFirst({
      where: { campaignId, characterId: character.id },
      select: { entityId: true },
    });
    if (!binding)
      throw new NotFoundException('Personagem não vinculado a esta campanha.');

    await tx.$queryRaw`SELECT id FROM \`Character\` WHERE id = ${character.id} FOR UPDATE`;
    character = await tx.character.findUnique({
      where: { id: character.id },
    });
    if (!character) throw new NotFoundException('Personagem não encontrado.');

    const economy = await this.combat.assertCanAct(
      tx,
      campaignId,
      character.id,
      isMaster,
    );

    const encounter = await tx.combatEncounter.findUnique({
      where: { campaignId },
    });
    let participant: CombatParticipant | null = null;
    if (encounter) {
      participant = await tx.combatParticipant.findFirst({
        where: { encounterId: encounter.id, characterId: character.id },
      });
      if (participant) {
        await tx.$queryRaw`SELECT id FROM \`CombatParticipant\` WHERE id = ${participant.id} FOR UPDATE`;
        participant = await tx.combatParticipant.findUnique({
          where: { id: participant.id },
        });
      }
    }

    if (
      encounter &&
      dto.expectedRevision !== undefined &&
      expectedRevisionMismatch(encounter.revision, dto.expectedRevision)
    ) {
      throw new ConflictException(
        'O combate mudou. Recarregue antes de usar o item.',
      );
    }

    const effect = parseItemEffect(inventory.item.properties);
    if (!effect)
      throw new BadRequestException(
        'Este item não tem um efeito utilizável pelo motor.',
      );

    const hpBefore: HpSnapshot = participant
      ? {
          current: participant.currentHp,
          max: participant.maxHp,
          temp: participant.tempHp,
        }
      : {
          current: character.currentHp,
          max: character.maxHp,
          temp: character.tempHp,
        };

    let amount: number;
    let breakdown: ItemUseResult['breakdown'] = null;
    if (effect.formula) {
      breakdown = this.dice.parseAndRoll(effect.formula);
      amount = Math.max(0, breakdown.total);
    } else {
      amount = effect.amount ?? 0;
    }

    let hpAfter = hpBefore;
    let applied = 0;
    let absorbedByTempHp = 0;
    let defense: DamageDefense | null = null;
    if (effect.kind === 'DAMAGE') {
      defense = await this.combat.resolveDamageDefense(
        tx,
        character.id,
        effect.damageType,
        amount,
      );
      amount = defense.adjusted;
    }
    if (effect.kind === 'HEAL') {
      hpAfter = applyHeal(hpBefore, amount);
      applied = hpAfter.current - hpBefore.current;
    } else if (effect.kind === 'TEMP_HP') {
      hpAfter = applyTempHp(hpBefore, amount);
      applied = hpAfter.temp - hpBefore.temp;
    } else {
      const damage = applyDamage(hpBefore, amount);
      hpAfter = damage.hp;
      applied = damage.applied;
      absorbedByTempHp = damage.absorbedByTempHp;
    }

    if (participant) {
      await tx.combatParticipant.update({
        where: { id: participant.id },
        data: { currentHp: hpAfter.current, tempHp: hpAfter.temp },
      });
    }
    await tx.character.update({
      where: { id: character.id },
      data: {
        currentHp: Math.min(hpAfter.current, character.maxHp),
        tempHp: hpAfter.temp,
      },
    });

    if (economy) await this.combat.consumeAction(tx, economy.participantId);

    if (participant) {
      await this.combat.reconcileVitals(
        tx,
        participant.id,
        effect.kind === 'DAMAGE' && hpBefore.current === 0 && applied > 0,
      );
    }
    if (effect.kind === 'DAMAGE' && applied > 0) {
      await this.combat.breakConcentrationOnDamage(tx, character.id, applied);
    }

    const quantityBefore = inventory.quantity;
    const quantityAfter = quantityBefore - 1;
    if (quantityAfter <= 0) {
      await tx.inventoryItem.delete({ where: { id: inventory.id } });
    } else {
      await tx.inventoryItem.update({
        where: { id: inventory.id },
        data: { quantity: quantityAfter },
      });
    }

    if (encounter) {
      if (dto.expectedRevision !== undefined) {
        const claimed = await tx.combatEncounter.updateMany({
          where: { id: encounter.id, revision: dto.expectedRevision },
          data: { revision: { increment: 1 } },
        });
        if (claimed.count === 0)
          throw new ConflictException(
            'O combate mudou. Recarregue antes de usar o item.',
          );
      } else {
        await tx.combatEncounter.update({
          where: { id: encounter.id },
          data: { revision: { increment: 1 } },
        });
      }
    }

    const resultData: Omit<ItemUseResult, 'actionId' | 'createdAt'> = {
      requestKey: dto.requestKey,
      kind: 'USE_ITEM',
      effectKind: effect.kind,
      target: {
        kind: 'CHARACTER',
        id: character.id,
        name: character.name,
        characterId: character.id,
      },
      amount,
      breakdown,
      damageType: effect.damageType,
      hpBefore,
      hpAfter,
      applied,
      absorbedByTempHp,
      defense,
      item: {
        inventoryItemId: inventory.id,
        itemId: inventory.itemId,
        name: inventory.item.name,
        quantityBefore,
        quantityAfter: Math.max(0, quantityAfter),
      },
      source: inventory.item.name,
      alreadyApplied: false,
    };

    const action = await tx.combatAction.create({
      data: {
        campaignId,
        encounterId: encounter?.id ?? null,
        actorUserId: userId,
        requestKey: dto.requestKey,
        requestHash,
        kind: 'USE_ITEM',
        targetKind: 'CHARACTER',
        targetId: character.id,
        targetName: character.name,
        payload: JSON.stringify({
          inventoryItemId: dto.inventoryItemId,
          characterId: dto.characterId,
          expectedRevision: dto.expectedRevision ?? null,
          effect,
        }),
        result: JSON.stringify({
          ...resultData,
          actionId: '',
          createdAt: new Date().toISOString(),
        }),
      },
    });
    const result: ItemUseResult = {
      ...resultData,
      actionId: action.id,
      createdAt: action.createdAt.toISOString(),
    };
    await tx.combatAction.update({
      where: { id: action.id },
      data: { result: JSON.stringify(result) },
    });

    return { result, participantId: participant?.id ?? null };
  }

  private findPrevious(campaignId: string, userId: string, requestKey: string) {
    return this.prisma.combatAction.findFirst({
      where: { campaignId, actorUserId: userId, requestKey },
    });
  }

  private replay(action: { id: string; result: string }): ItemUseResult {
    const parsed = parseJson(action.result);
    if (!parsed || typeof parsed !== 'object')
      throw new ConflictException('Resultado anterior indisponível.');
    return {
      ...(parsed as ItemUseResult),
      actionId: action.id,
      alreadyApplied: true,
    };
  }
}

function expectedRevisionMismatch(actual: number, expected: number) {
  return actual !== expected;
}
