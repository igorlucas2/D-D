import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { DiceVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VttGateway } from '../vtt/vtt.gateway';
import { RollDiceDto } from './dto/roll-dice.dto';

export interface RollBreakdown {
  diceCount: number;
  diceSides: number;
  rolls: number[];
  modifier: number;
  total: number;
}

const FORMULA_REGEX = /^(\d+)d(\d+)([+-]\d+)?$/i;
const MAX_DICE = 20;
const MAX_MODIFIER = 100;
const CAMPAIGN_HISTORY_LIMIT = 30;

const ROLL_INCLUDE = {
  character: { select: { id: true, name: true } },
  user: { select: { id: true, displayName: true } },
} satisfies Prisma.DiceRollInclude;

type RollWithAuthor = Prisma.DiceRollGetPayload<{
  include: typeof ROLL_INCLUDE;
}>;

export type SerializedDiceRoll = Omit<RollWithAuthor, 'breakdown'> & {
  breakdown: RollBreakdown;
};

@Injectable()
export class DiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vttGateway: VttGateway,
  ) {}

  parseAndRoll(formula: string): RollBreakdown {
    const match = formula.replace(/\s/g, '').match(FORMULA_REGEX);
    if (!match) {
      throw new BadRequestException('Fórmula de dados inválida.');
    }

    const diceCount = parseInt(match[1], 10);
    const diceSides = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;
    if (diceCount < 1 || diceCount > MAX_DICE) {
      throw new BadRequestException(`Role entre 1 e ${MAX_DICE} dados.`);
    }
    if (Math.abs(modifier) > MAX_MODIFIER) {
      throw new BadRequestException(
        `O modificador deve ficar entre -${MAX_MODIFIER} e +${MAX_MODIFIER}.`,
      );
    }

    // O resultado é decidido uma única vez, aqui; o cliente só anima.
    const rolls = Array.from({ length: diceCount }, () =>
      randomInt(1, diceSides + 1),
    );
    const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;

    return { diceCount, diceSides, rolls, modifier, total };
  }

  async roll(userId: string, dto: RollDiceDto) {
    const campaign = dto.campaignId
      ? await this.assertIsMember(dto.campaignId, userId)
      : null;
    if (dto.characterId)
      await this.assertOwnsCharacter(dto.characterId, userId);

    const breakdown = this.parseAndRoll(dto.formula);
    // Na mesa, a rolagem é pública por padrão; fora dela, sempre privada.
    const visibility: DiceVisibility = campaign
      ? (dto.visibility ?? 'PUBLIC')
      : 'PRIVATE';

    const diceRoll = await this.prisma.diceRoll.create({
      data: {
        userId,
        characterId: dto.characterId,
        campaignId: campaign?.id,
        visibility,
        formula: dto.formula,
        result: breakdown.total,
        breakdown: JSON.stringify(breakdown),
      },
      include: ROLL_INCLUDE,
    });

    const serialized = this.serialize(diceRoll);
    if (campaign) this.vttGateway.emitRoll(campaign.id, serialized);
    return serialized;
  }

  async getHistory(userId: string, take = 50) {
    const rolls = await this.prisma.diceRoll.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      include: ROLL_INCLUDE,
    });

    return rolls.map((roll) => this.serialize(roll));
  }

  /** Rolagens recentes da mesa que o usuário pode ver. */
  async getCampaignRolls(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    const isMaster = campaign.masterId === userId;

    const rolls = await this.prisma.diceRoll.findMany({
      where: {
        campaignId,
        OR: [
          { visibility: 'PUBLIC' },
          { userId },
          ...(isMaster ? [{ visibility: DiceVisibility.MASTER }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: CAMPAIGN_HISTORY_LIMIT,
      include: ROLL_INCLUDE,
    });

    return rolls.map((roll) => this.serialize(roll));
  }

  private serialize(roll: RollWithAuthor): SerializedDiceRoll {
    return {
      ...roll,
      breakdown: JSON.parse(roll.breakdown) as RollBreakdown,
    };
  }

  private async assertIsMember(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');

    const isMember =
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Você não tem acesso a esta campanha.');
    }
    return campaign;
  }

  private async assertOwnsCharacter(characterId: string, userId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true },
    });
    if (!character || character.userId !== userId) {
      throw new ForbiddenException('Este personagem não é seu.');
    }
  }
}
