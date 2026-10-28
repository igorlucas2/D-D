import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Character,
  type CombatParticipant,
  type CharacterSpellSlot,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { parseJson, parseStringArray } from '../common/json';
import { DiceService } from '../dice/dice.service';
import { PrismaService } from '../prisma/prisma.service';
import { CombatService, hpStatus } from './combat.service';
import { applyDamage, applyHeal, type HpSnapshot } from './combat-action.types';
import { canonical } from '../game-actions/game-action.types';
import { CastSpellDto } from './spell-cast.dto';
import {
  abilityModifier,
  resolveSpellMechanics,
  spellSaveDc,
  spellcastingModifier,
  type SpellAbility,
  type SpellCastResult,
} from './spell-cast.types';

type Tx = Prisma.TransactionClient;

interface TargetRef {
  kind: 'CHARACTER' | 'PARTICIPANT';
  id: string;
  name: string;
  characterId: string | null;
  character: Character | null;
  participant: CombatParticipant | null;
}

interface Execution {
  result: SpellCastResult;
  emits: Array<{
    participantId: string;
    delta: number;
    hpStatus: ReturnType<typeof hpStatus>;
  }>;
}

@Injectable()
export class SpellCastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly combat: CombatService,
    private readonly dice: DiceService,
  ) {}

  async cast(campaignId: string, userId: string, dto: CastSpellDto) {
    const campaign = await this.access.member(campaignId, userId);
    const requestHash = createHash('sha256')
      .update(
        canonical({
          characterSpellId: dto.characterSpellId,
          slotLevel: dto.slotLevel ?? null,
          targets: dto.targets,
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
          'Esta chave de conjuração já foi usada com outro conteúdo.',
        );
      return this.replay(previous);
    }

    let execution: Execution;
    try {
      execution = await this.prisma.$transaction(
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

    for (const emit of execution.emits) {
      await this.combat.emitAction(campaignId, {
        type: 'hp',
        participantId: emit.participantId,
        delta: emit.delta,
        hpStatus: emit.hpStatus,
      });
    }
    return execution.result;
  }

  private async execute(
    tx: Tx,
    campaignId: string,
    userId: string,
    isMaster: boolean,
    dto: CastSpellDto,
    requestHash: string,
  ): Promise<Execution> {
    const characterSpell = await tx.characterSpell.findUnique({
      where: { id: dto.characterSpellId },
      include: { spell: true, character: true },
    });
    if (!characterSpell)
      throw new NotFoundException('Magia do personagem não encontrada.');
    if (characterSpell.character.userId !== userId)
      throw new ForbiddenException(
        'Você só pode conjurar magias do seu próprio personagem.',
      );
    const caster = characterSpell.character;
    const binding = await tx.campaignCharacter.findFirst({
      where: { campaignId, characterId: caster.id },
      select: { entityId: true },
    });
    if (!binding)
      throw new NotFoundException('Personagem não vinculado a esta campanha.');

    const mechanics = resolveSpellMechanics(characterSpell.spell);
    if (!mechanics)
      throw new BadRequestException(
        'Esta magia ainda não tem mecânica utilizável pelo motor.',
      );
    if (mechanics.targets === 'SINGLE' && dto.targets.length !== 1)
      throw new BadRequestException('Esta magia exige exatamente um alvo.');
    if (mechanics.attack && dto.targets.length !== 1)
      throw new BadRequestException(
        'Ataques mágicos exigem exatamente um alvo.',
      );
    if (mechanics.targets === 'MULTIPLE' && dto.targets.length > 12)
      throw new BadRequestException('Máximo de 12 alvos por conjuração.');

    await tx.$queryRaw`SELECT id FROM \`Character\` WHERE id = ${caster.id} FOR UPDATE`;
    const casterLocked = await tx.character.findUnique({
      where: { id: caster.id },
    });
    if (!casterLocked)
      throw new NotFoundException('Personagem não encontrado.');
    const economy = await this.combat.assertCanAct(
      tx,
      campaignId,
      casterLocked.id,
      isMaster,
    );

    const castLevel =
      characterSpell.spell.level === 0
        ? 0
        : (dto.slotLevel ?? characterSpell.spell.level);
    if (
      characterSpell.spell.level > 0 &&
      (castLevel < characterSpell.spell.level || castLevel > 9)
    ) {
      throw new BadRequestException(
        'O espaço escolhido não pode conjurar esta magia.',
      );
    }

    let slot: CharacterSpellSlot | null = null;
    if (castLevel > 0) {
      await tx.$queryRaw`SELECT id FROM \`CharacterSpellSlot\` WHERE characterId = ${caster.id} AND level = ${castLevel} FOR UPDATE`;
      slot = await tx.characterSpellSlot.findUnique({
        where: {
          characterId_level: { characterId: caster.id, level: castLevel },
        },
      });
      if (!slot || slot.used >= slot.total)
        throw new BadRequestException(
          'Não há espaço de magia disponível neste nível.',
        );
    }

    const encounter = await tx.combatEncounter.findUnique({
      where: { campaignId },
    });
    const targets = await this.resolveTargets(tx, campaignId, encounter, dto);

    const characterIds = [
      ...new Set(
        targets
          .map((target) => target.characterId)
          .filter((id): id is string => Boolean(id)),
      ),
    ].sort();
    const participantIds = [
      ...new Set(
        targets
          .map((target) => target.participant?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ].sort();
    for (const id of characterIds) {
      await tx.$queryRaw`SELECT id FROM \`Character\` WHERE id = ${id} FOR UPDATE`;
    }
    for (const id of participantIds) {
      await tx.$queryRaw`SELECT id FROM \`CombatParticipant\` WHERE id = ${id} FOR UPDATE`;
    }

    if (
      encounter &&
      dto.expectedRevision !== undefined &&
      encounter.revision !== dto.expectedRevision
    ) {
      throw new ConflictException(
        'O combate mudou. Recarregue antes de conjurar.',
      );
    }

    const damageTotal =
      mechanics.kind === 'DAMAGE'
        ? this.rollDamage(
            mechanics.formula,
            mechanics.upcast?.formula ?? null,
            castLevel,
            characterSpell.spell.level,
          )
        : 0;
    const healingTotal =
      mechanics.kind === 'HEAL'
        ? this.rollDamage(
            mechanics.formula,
            mechanics.upcast?.formula ?? null,
            castLevel,
            characterSpell.spell.level,
          ) +
          (mechanics.addSpellcastingModifier
            ? spellcastingModifier(casterLocked)
            : 0)
        : 0;
    const casterModifier = spellcastingModifier(casterLocked);
    const saveDc = spellSaveDc(casterLocked.proficiencyBonus, casterModifier);

    const isMark = mechanics.kind === 'MARK';
    const markSpec = mechanics.concentration ?? null;
    if (isMark) {
      if (!markSpec)
        throw new BadRequestException(
          'Esta marca não tem regra de concentração configurada.',
        );
      if (targets.length !== 1 || !targets[0].participant)
        throw new BadRequestException(
          'A Marca do Caçador exige exatamente um participante em combate.',
        );
    }
    const markStartedAt = new Date();
    const markExpiresAt = new Date(
      markStartedAt.getTime() + (markSpec?.durationMinutes ?? 60) * 60_000,
    );
    if (isMark && markSpec) {
      await this.combat.setConcentration(tx, casterLocked.id, {
        spellId: characterSpell.spell.id,
        spellName: characterSpell.spell.name,
        targetKind: 'PARTICIPANT',
        targetId: targets[0].participant!.id,
        targetName: targets[0].participant!.name,
        condition: markSpec.condition,
        bonusFormula: markSpec.bonusFormula,
        startedAt: markStartedAt.toISOString(),
        expiresAt: markExpiresAt.toISOString(),
      });
    }

    const targetResults: SpellCastResult['targets'] = [];
    const emits: Execution['emits'] = [];

    for (const target of targets) {
      const character = target.characterId
        ? await tx.character.findUnique({ where: { id: target.characterId } })
        : null;
      const participant = target.participant
        ? await tx.combatParticipant.findUnique({
            where: { id: target.participant.id },
          })
        : null;
      if (!character && !participant)
        throw new NotFoundException('Alvo não encontrado.');

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

      if (isMark) {
        if (!participant || !markSpec)
          throw new BadRequestException(
            'A Marca do Caçador exige um participante em combate.',
          );
        const conditions = parseStringArray(participant.conditions);
        if (
          !conditions.some(
            (item) => item.toLowerCase() === markSpec.condition.toLowerCase(),
          )
        )
          conditions.push(markSpec.condition);
        await tx.combatParticipant.update({
          where: { id: participant.id },
          data: { conditions: JSON.stringify(conditions) },
        });
        emits.push({
          participantId: participant.id,
          delta: 0,
          hpStatus: hpStatus(hpBefore.current, hpBefore.max),
        });
        targetResults.push({
          kind: 'PARTICIPANT',
          id: participant.id,
          name: participant.name,
          characterId: participant.characterId,
          hpBefore,
          hpAfter: hpBefore,
          save: null,
          attack: null,
          amount: 0,
          applied: 0,
          absorbedByTempHp: 0,
        });
        continue;
      }

      let save: SpellCastResult['targets'][number]['save'] = null;
      let attack: SpellCastResult['targets'][number]['attack'] = null;
      let amount = mechanics.kind === 'HEAL' ? healingTotal : damageTotal;
      if (mechanics.kind === 'DAMAGE' && mechanics.save) {
        const ability = mechanics.save.ability;
        const modifier = character ? this.saveModifier(character, ability) : 0;
        const roll = this.dice.parseAndRoll('1d20');
        const total = roll.total + modifier;
        const success = total >= saveDc;
        save = {
          ability,
          roll: roll.total,
          modifier,
          total,
          dc: saveDc,
          success,
        };
        if (success)
          amount = mechanics.save.halfOnSuccess ? Math.floor(amount / 2) : 0;
      } else if (mechanics.kind === 'DAMAGE' && mechanics.attack) {
        const modifier = casterLocked.proficiencyBonus + casterModifier;
        const roll = this.dice.parseAndRoll('1d20');
        const total = roll.total + modifier;
        const ac = character?.armorClass ?? 10;
        const critical = roll.total === 20;
        const hit = roll.total !== 1 && (critical || total >= ac);
        attack = {
          roll: roll.total,
          modifier,
          total,
          ac,
          hit,
          critical,
        };
        if (!hit) {
          amount = 0;
        } else if (critical) {
          amount += this.rollDamage(
            mechanics.formula,
            mechanics.upcast?.formula ?? null,
            castLevel,
            characterSpell.spell.level,
          );
        }
      }

      let hpAfter = hpBefore;
      let applied = 0;
      let absorbedByTempHp = 0;
      if (mechanics.kind === 'HEAL') {
        hpAfter = applyHeal(hpBefore, amount);
        applied = hpAfter.current - hpBefore.current;
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
      if (character) {
        await tx.character.update({
          where: { id: character.id },
          data: {
            currentHp: Math.min(hpAfter.current, character.maxHp),
            tempHp: hpAfter.temp,
          },
        });
      }
      if (character && mechanics.kind === 'DAMAGE' && applied > 0) {
        await this.combat.breakConcentrationOnDamage(tx, character.id, applied);
      }
      if (participant) {
        await this.combat.reconcileVitals(
          tx,
          participant.id,
          mechanics.kind === 'DAMAGE' && hpBefore.current === 0 && amount > 0,
        );
        emits.push({
          participantId: participant.id,
          delta: hpAfter.current - hpBefore.current,
          hpStatus: hpStatus(hpAfter.current, hpAfter.max),
        });
      }

      const hidden =
        !isMaster &&
        participant &&
        !participant.isAlly &&
        encounter?.hpDisplay === 'DESCRIPTIVE';
      targetResults.push({
        kind: target.kind,
        id: target.id,
        name: target.name,
        characterId: target.characterId,
        hpBefore: hidden ? null : hpBefore,
        hpAfter: hidden ? null : hpAfter,
        save,
        attack,
        amount,
        applied,
        absorbedByTempHp,
      });
    }

    let slotResult: SpellCastResult['slot'] = null;
    if (slot) {
      const usedAfter = slot.used + 1;
      await tx.characterSpellSlot.update({
        where: { id: slot.id },
        data: { used: usedAfter },
      });
      slotResult = { level: slot.level, usedBefore: slot.used, usedAfter };
    }

    if (economy) await this.combat.consumeAction(tx, economy.participantId);

    if (encounter) {
      if (dto.expectedRevision !== undefined) {
        const claimed = await tx.combatEncounter.updateMany({
          where: { id: encounter.id, revision: dto.expectedRevision },
          data: { revision: { increment: 1 } },
        });
        if (claimed.count === 0)
          throw new ConflictException(
            'O combate mudou. Recarregue antes de conjurar.',
          );
      } else {
        await tx.combatEncounter.update({
          where: { id: encounter.id },
          data: { revision: { increment: 1 } },
        });
      }
    }

    const resultData: Omit<SpellCastResult, 'actionId' | 'createdAt'> = {
      requestKey: dto.requestKey,
      kind: 'CAST_SPELL',
      spell: {
        characterSpellId: characterSpell.id,
        spellId: characterSpell.spell.id,
        name: characterSpell.spell.name,
        level: characterSpell.spell.level,
        school: characterSpell.spell.school,
        castLevel,
      },
      slot: slotResult,
      targets: targetResults,
      damageType: mechanics.kind === 'DAMAGE' ? mechanics.damageType : null,
      effectKind: mechanics.kind,
      mark:
        isMark && markSpec
          ? {
              condition: markSpec.condition,
              bonusFormula: markSpec.bonusFormula,
              durationMinutes: markSpec.durationMinutes,
              expiresAt: markExpiresAt.toISOString(),
            }
          : null,
      source: characterSpell.spell.name,
      alreadyApplied: false,
    };

    const first = targetResults[0];
    const action = await tx.combatAction.create({
      data: {
        campaignId,
        encounterId: encounter?.id ?? null,
        actorUserId: userId,
        requestKey: dto.requestKey,
        requestHash,
        kind: 'CAST_SPELL',
        targetKind: first?.kind ?? 'CHARACTER',
        targetId: first?.id ?? caster.id,
        targetName: first?.name ?? characterSpell.spell.name,
        payload: JSON.stringify({
          characterSpellId: dto.characterSpellId,
          slotLevel: dto.slotLevel ?? null,
          targets: dto.targets,
          expectedRevision: dto.expectedRevision ?? null,
        }),
        result: JSON.stringify({
          ...resultData,
          actionId: '',
          createdAt: new Date().toISOString(),
        }),
      },
    });
    const result: SpellCastResult = {
      ...resultData,
      actionId: action.id,
      createdAt: action.createdAt.toISOString(),
    };
    await tx.combatAction.update({
      where: { id: action.id },
      data: { result: JSON.stringify(result) },
    });

    return { result, emits };
  }

  private async resolveTargets(
    tx: Tx,
    campaignId: string,
    encounter: { id: string } | null,
    dto: CastSpellDto,
  ): Promise<TargetRef[]> {
    const targets: TargetRef[] = [];
    const seen = new Set<string>();
    for (const input of dto.targets) {
      const key = `${input.kind}:${input.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (input.kind === 'PARTICIPANT') {
        if (!encounter)
          throw new NotFoundException(
            'Nenhum combate em andamento nesta campanha.',
          );
        const participant = await tx.combatParticipant.findUnique({
          where: { id: input.id },
        });
        if (!participant || participant.encounterId !== encounter.id)
          throw new NotFoundException('Participante não encontrado.');
        const character = participant.characterId
          ? await tx.character.findUnique({
              where: { id: participant.characterId },
            })
          : null;
        targets.push({
          kind: 'PARTICIPANT',
          id: participant.id,
          name: participant.name,
          characterId: participant.characterId,
          character,
          participant,
        });
      } else {
        const binding = await tx.campaignCharacter.findFirst({
          where: { campaignId, characterId: input.id },
          include: { character: true },
        });
        if (!binding) throw new NotFoundException('Personagem não encontrado.');
        const participant = encounter
          ? await tx.combatParticipant.findFirst({
              where: {
                encounterId: encounter.id,
                characterId: binding.characterId,
              },
            })
          : null;
        targets.push({
          kind: 'CHARACTER',
          id: binding.character.id,
          name: binding.character.name,
          characterId: binding.character.id,
          character: binding.character,
          participant,
        });
      }
    }
    return targets;
  }

  private saveModifier(character: Character, ability: SpellAbility): number {
    const scores: Record<SpellAbility, number> = {
      STR: character.strength,
      DEX: character.dexterity,
      CON: character.constitution,
      INT: character.intelligence,
      WIS: character.wisdom,
      CHA: character.charisma,
    };
    return abilityModifier(scores[ability]);
  }

  private rollDamage(
    baseFormula: string,
    upcastFormula: string | null,
    castLevel: number,
    spellLevel: number,
  ): number {
    let total = this.dice.parseAndRoll(baseFormula).total;
    const extraLevels = Math.max(0, castLevel - spellLevel);
    if (upcastFormula && extraLevels > 0) {
      for (let index = 0; index < extraLevels; index++) {
        total += this.dice.parseAndRoll(upcastFormula).total;
      }
    }
    return Math.max(0, total);
  }

  private findPrevious(campaignId: string, userId: string, requestKey: string) {
    return this.prisma.combatAction.findFirst({
      where: { campaignId, actorUserId: userId, requestKey },
    });
  }

  private replay(action: { id: string; result: string }): SpellCastResult {
    const parsed = parseJson(action.result);
    if (!parsed || typeof parsed !== 'object')
      throw new ConflictException('Resultado anterior indisponível.');
    return {
      ...(parsed as SpellCastResult),
      actionId: action.id,
      alreadyApplied: true,
    };
  }
}
