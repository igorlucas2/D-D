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
import { applyDamage, type HpSnapshot } from './combat-action.types';
import { canonical } from '../game-actions/game-action.types';
import { WeaponAttackDto } from './weapon-attack.dto';
import {
  attackAbilityModifier,
  parseWeaponMechanics,
  weaponAbilityScore,
  type WeaponAttackResult,
} from './weapon-attack.types';

type Tx = Prisma.TransactionClient;

@Injectable()
export class WeaponAttackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly combat: CombatService,
    private readonly dice: DiceService,
  ) {}

  async attack(campaignId: string, userId: string, dto: WeaponAttackDto) {
    const campaign = await this.access.member(campaignId, userId);
    const requestHash = createHash('sha256')
      .update(
        canonical({
          inventoryItemId: dto.inventoryItemId,
          targetKind: dto.targetKind,
          targetId: dto.targetId,
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
          'Esta chave de ataque já foi usada com outro conteúdo.',
        );
      return this.replay(previous);
    }

    let executed: {
      result: WeaponAttackResult;
      participantId: string | null;
    };
    try {
      executed = await this.prisma.$transaction(
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

    if (executed.participantId) {
      await this.combat.emitAction(campaignId, {
        type: 'hp',
        participantId: executed.participantId,
        delta:
          (executed.result.hpAfter?.current ?? 0) -
          (executed.result.hpBefore?.current ?? 0),
        hpStatus: executed.result.hpAfter
          ? hpStatus(
              executed.result.hpAfter.current,
              executed.result.hpAfter.max,
            )
          : hpStatus(0, 1),
      });
    }
    return executed.result;
  }

  private async execute(
    tx: Tx,
    campaignId: string,
    userId: string,
    isMaster: boolean,
    dto: WeaponAttackDto,
    requestHash: string,
  ): Promise<{ result: WeaponAttackResult; participantId: string | null }> {
    await tx.$queryRaw`SELECT id FROM \`InventoryItem\` WHERE id = ${dto.inventoryItemId} FOR UPDATE`;
    const inventory = await tx.inventoryItem.findUnique({
      where: { id: dto.inventoryItemId },
      include: { item: true },
    });
    if (!inventory) throw new NotFoundException('Arma não encontrada.');
    if (inventory.item.category !== 'Arma')
      throw new BadRequestException('Este item não é uma arma.');
    let attacker: Character | null = await tx.character.findUnique({
      where: { id: inventory.characterId },
    });
    if (!attacker || attacker.userId !== userId)
      throw new ForbiddenException(
        'Você só pode atacar com armas do seu próprio personagem.',
      );
    const binding = await tx.campaignCharacter.findFirst({
      where: { campaignId, characterId: attacker.id },
      select: { entityId: true },
    });
    if (!binding)
      throw new NotFoundException('Personagem não vinculado a esta campanha.');

    await tx.$queryRaw`SELECT id FROM \`Character\` WHERE id = ${attacker.id} FOR UPDATE`;
    attacker = await tx.character.findUnique({
      where: { id: attacker.id },
    });
    if (!attacker) throw new NotFoundException('Personagem não encontrado.');

    const mechanics = parseWeaponMechanics(inventory.item.properties);
    if (!mechanics)
      throw new BadRequestException(
        'A arma não tem dados de dano utilizáveis.',
      );

    const encounter = await tx.combatEncounter.findUnique({
      where: { campaignId },
    });
    let targetCharacter: Character | null = null;
    let targetParticipant: CombatParticipant | null = null;
    if (dto.targetKind === 'PARTICIPANT') {
      if (!encounter)
        throw new NotFoundException(
          'Nenhum combate em andamento nesta campanha.',
        );
      targetParticipant = await tx.combatParticipant.findUnique({
        where: { id: dto.targetId },
      });
      if (!targetParticipant || targetParticipant.encounterId !== encounter.id)
        throw new NotFoundException('Participante não encontrado.');
      if (targetParticipant.characterId) {
        targetCharacter = await tx.character.findUnique({
          where: { id: targetParticipant.characterId },
        });
      }
    } else {
      const targetBinding = await tx.campaignCharacter.findFirst({
        where: { campaignId, characterId: dto.targetId },
        include: { character: true },
      });
      if (!targetBinding) throw new NotFoundException('Alvo não encontrado.');
      targetCharacter = targetBinding.character;
      if (encounter) {
        targetParticipant = await tx.combatParticipant.findFirst({
          where: {
            encounterId: encounter.id,
            characterId: targetCharacter.id,
          },
        });
      }
    }

    if (targetCharacter) {
      await tx.$queryRaw`SELECT id FROM \`Character\` WHERE id = ${targetCharacter.id} FOR UPDATE`;
      targetCharacter = await tx.character.findUnique({
        where: { id: targetCharacter.id },
      });
    }
    if (targetParticipant) {
      await tx.$queryRaw`SELECT id FROM \`CombatParticipant\` WHERE id = ${targetParticipant.id} FOR UPDATE`;
      targetParticipant = await tx.combatParticipant.findUnique({
        where: { id: targetParticipant.id },
      });
    }
    if (!targetCharacter && !targetParticipant)
      throw new NotFoundException('Alvo não encontrado.');

    if (
      encounter &&
      dto.expectedRevision !== undefined &&
      encounter.revision !== dto.expectedRevision
    ) {
      throw new ConflictException(
        'O combate mudou. Recarregue antes de atacar.',
      );
    }

    const hpBefore: HpSnapshot = targetParticipant
      ? {
          current: targetParticipant.currentHp,
          max: targetParticipant.maxHp,
          temp: targetParticipant.tempHp,
        }
      : {
          current: targetCharacter!.currentHp,
          max: targetCharacter!.maxHp,
          temp: targetCharacter!.tempHp,
        };
    const ac = targetCharacter?.armorClass ?? 10;
    const abilityScore = weaponAbilityScore(attacker, mechanics);
    const abilityModifier = attackAbilityModifier(abilityScore);
    const attackModifier = attacker.proficiencyBonus + abilityModifier;
    const attackRoll = this.dice.parseAndRoll('1d20');
    const total = attackRoll.total + attackModifier;
    const critical = attackRoll.total === 20;
    const hit = attackRoll.total !== 1 && (critical || total >= ac);

    let amount = 0;
    if (hit) {
      amount =
        (mechanics.damageFormula
          ? this.dice.parseAndRoll(mechanics.damageFormula).total
          : (mechanics.fixedDamage ?? 0)) + abilityModifier;
      if (critical) {
        amount += mechanics.damageFormula
          ? this.dice.parseAndRoll(mechanics.damageFormula).total
          : (mechanics.fixedDamage ?? 0);
      }
      amount = Math.max(0, amount);
    }
    const damage = applyDamage(hpBefore, amount);
    const hpAfter = damage.hp;

    if (targetParticipant) {
      await tx.combatParticipant.update({
        where: { id: targetParticipant.id },
        data: { currentHp: hpAfter.current, tempHp: hpAfter.temp },
      });
    }
    if (targetCharacter) {
      await tx.character.update({
        where: { id: targetCharacter.id },
        data: {
          currentHp: Math.min(hpAfter.current, targetCharacter.maxHp),
          tempHp: hpAfter.temp,
        },
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
            'O combate mudou. Recarregue antes de atacar.',
          );
      } else {
        await tx.combatEncounter.update({
          where: { id: encounter.id },
          data: { revision: { increment: 1 } },
        });
      }
    }

    const target = targetParticipant ?? targetCharacter!;
    const targetName = target.name;
    const targetKind = targetParticipant ? 'PARTICIPANT' : 'CHARACTER';
    const hidden =
      !isMaster &&
      targetParticipant &&
      !targetParticipant.isAlly &&
      encounter?.hpDisplay === 'DESCRIPTIVE';

    const resultData: Omit<WeaponAttackResult, 'actionId' | 'createdAt'> = {
      requestKey: dto.requestKey,
      kind: 'WEAPON_ATTACK',
      weapon: {
        inventoryItemId: inventory.id,
        itemId: inventory.itemId,
        name: inventory.item.name,
      },
      target: {
        kind: targetKind,
        id: dto.targetId,
        name: targetName,
        characterId: targetCharacter?.id ?? null,
      },
      attack: {
        roll: attackRoll.total,
        modifier: attackModifier,
        total,
        ac,
        hit,
        critical,
      },
      damage: {
        formula: mechanics.damageFormula,
        fixed: mechanics.fixedDamage,
        modifier: abilityModifier,
        amount: hit ? amount : 0,
        damageType: mechanics.damageType,
        critical,
      },
      hpBefore: hidden ? null : hpBefore,
      hpAfter: hidden ? null : hpAfter,
      applied: damage.applied,
      absorbedByTempHp: damage.absorbedByTempHp,
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
        kind: 'WEAPON_ATTACK',
        targetKind,
        targetId: dto.targetId,
        targetName,
        payload: JSON.stringify({
          inventoryItemId: dto.inventoryItemId,
          targetKind: dto.targetKind,
          targetId: dto.targetId,
          expectedRevision: dto.expectedRevision ?? null,
        }),
        result: JSON.stringify({
          ...resultData,
          actionId: '',
          createdAt: new Date().toISOString(),
        }),
      },
    });
    const result: WeaponAttackResult = {
      ...resultData,
      actionId: action.id,
      createdAt: action.createdAt.toISOString(),
    };
    await tx.combatAction.update({
      where: { id: action.id },
      data: { result: JSON.stringify(result) },
    });

    return { result, participantId: targetParticipant?.id ?? null };
  }

  private findPrevious(campaignId: string, userId: string, requestKey: string) {
    return this.prisma.combatAction.findFirst({
      where: { campaignId, actorUserId: userId, requestKey },
    });
  }

  private replay(action: { id: string; result: string }): WeaponAttackResult {
    const parsed = parseJson(action.result);
    if (!parsed || typeof parsed !== 'object')
      throw new ConflictException('Resultado anterior indisponível.');
    return {
      ...(parsed as WeaponAttackResult),
      actionId: action.id,
      alreadyApplied: true,
    };
  }
}
