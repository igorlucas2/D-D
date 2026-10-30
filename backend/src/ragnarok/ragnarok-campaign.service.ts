import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GrantRagnarokClassDto } from './dto/grant-ragnarok-class.dto';
import { GrantJobExpDto, GrantJobLevelDto } from './dto/grant-job-progress.dto';
import {
  GrantRagnarokItemDto,
  GrantRagnarokZenyDto,
} from './dto/grant-ragnarok-item.dto';
import { UpdateRagnarokConfigDto } from './dto/update-ragnarok-config.dto';

const JOB_MAX_LEVEL = 70;

function jobExpToNext(level: number) {
  return 100 + Math.max(0, level - 1) * 50;
}

const INCLUDE = {
  job: true,
  skills: { include: { skill: true }, orderBy: { createdAt: 'asc' } },
  equipment: { include: { item: true }, orderBy: { createdAt: 'asc' } },
} as const;

@Injectable()
export class RagnarokCampaignService {
  constructor(private readonly prisma: PrismaService) {}

  private async access(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (
      campaign.masterId !== userId &&
      !campaign.members.some((member) => member.userId === userId)
    ) {
      throw new ForbiddenException('Sem acesso à campanha.');
    }
    return campaign;
  }

  async list(campaignId: string, userId: string) {
    await this.access(campaignId, userId);
    const links = await this.prisma.campaignRagnarokCharacter.findMany({
      where: { campaignId },
      include: { character: { include: INCLUDE } },
      orderBy: { joinedAt: 'asc' },
    });
    return links.map((link) => link.character);
  }

  async bind(campaignId: string, userId: string, characterId: string) {
    const campaign = await this.access(campaignId, userId);
    const character = await this.prisma.ragnarokCharacter.findUnique({
      where: { id: characterId },
      select: { id: true, userId: true },
    });
    if (!character)
      throw new NotFoundException('Ficha Ragnarok não encontrada.');
    if (character.userId !== userId && campaign.masterId !== userId) {
      throw new ForbiddenException('Você só pode vincular sua própria ficha.');
    }
    const existing = await this.prisma.campaignRagnarokCharacter.findUnique({
      where: { characterId },
      select: { campaignId: true },
    });
    if (existing && existing.campaignId !== campaignId) {
      throw new BadRequestException(
        'Esta ficha já está vinculada a outra campanha.',
      );
    }
    await this.prisma.campaignRagnarokCharacter.upsert({
      where: { characterId },
      update: {},
      create: { campaignId, characterId },
    });
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id: characterId },
      include: INCLUDE,
    });
  }

  async unbind(campaignId: string, userId: string, characterId: string) {
    const campaign = await this.access(campaignId, userId);
    const character = await this.prisma.ragnarokCharacter.findUnique({
      where: { id: characterId },
      select: { userId: true },
    });
    if (!character)
      throw new NotFoundException('Ficha Ragnarok não encontrada.');
    if (character.userId !== userId && campaign.masterId !== userId) {
      throw new ForbiddenException(
        'Sem permissão para desvincular esta ficha.',
      );
    }
    await this.prisma.campaignRagnarokCharacter.deleteMany({
      where: { campaignId, characterId },
    });
    return { ok: true };
  }

  async grantJobLevel(
    campaignId: string,
    userId: string,
    characterId: string,
    dto: GrantJobLevelDto,
  ) {
    const campaign = await this.access(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Somente o mestre concede job level.');
    }
    const link = await this.prisma.campaignRagnarokCharacter.findFirst({
      where: { campaignId, characterId },
    });
    if (!link) {
      throw new BadRequestException('Ficha não vinculada a esta campanha.');
    }
    const current = await this.prisma.ragnarokCharacter.findUnique({
      where: { id: characterId },
      select: { jobLevel: true, skillPoints: true },
    });
    if (!current) throw new NotFoundException('Ficha Ragnarok não encontrada.');
    const level = Math.max(1, Math.min(JOB_MAX_LEVEL, dto.level));
    const gained = Math.max(0, level - current.jobLevel);
    return this.prisma.ragnarokCharacter.update({
      where: { id: characterId },
      data: {
        jobLevel: level,
        jobExp: 0,
        ...(gained ? { skillPoints: { increment: gained } } : {}),
      },
      include: INCLUDE,
    });
  }

  async grantJobExp(
    campaignId: string,
    userId: string,
    characterId: string,
    dto: GrantJobExpDto,
  ) {
    const campaign = await this.access(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Somente o mestre concede job EXP.');
    }
    const link = await this.prisma.campaignRagnarokCharacter.findFirst({
      where: { campaignId, characterId },
    });
    if (!link) {
      throw new BadRequestException('Ficha não vinculada a esta campanha.');
    }
    const current = await this.prisma.ragnarokCharacter.findUnique({
      where: { id: characterId },
      select: { jobLevel: true, jobExp: true },
    });
    if (!current) throw new NotFoundException('Ficha Ragnarok não encontrada.');

    let level = current.jobLevel;
    let exp = current.jobExp + dto.amount;
    let gained = 0;
    while (level < JOB_MAX_LEVEL && exp >= jobExpToNext(level)) {
      exp -= jobExpToNext(level);
      level += 1;
      gained += 1;
    }
    if (level >= JOB_MAX_LEVEL) exp = 0;

    return this.prisma.ragnarokCharacter.update({
      where: { id: characterId },
      data: {
        jobLevel: level,
        jobExp: exp,
        ...(gained ? { skillPoints: { increment: gained } } : {}),
      },
      include: INCLUDE,
    });
  }

  async kafraSave(campaignId: string, userId: string, characterId: string) {
    const campaign = await this.access(campaignId, userId);
    const link = await this.prisma.campaignRagnarokCharacter.findFirst({
      where: { campaignId, characterId },
    });
    if (!link) {
      throw new BadRequestException('Ficha não vinculada a esta campanha.');
    }
    const character = await this.prisma.ragnarokCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });
    if (!character) {
      throw new ForbiddenException('Esta ficha não pertence a você.');
    }
    const token = await this.prisma.vttToken.findUnique({
      where: { ragnarokCharacterId: characterId },
      select: { mapId: true, x: true, y: true },
    });
    if (!token) {
      throw new BadRequestException('Entre no mapa antes de usar a Kafra.');
    }
    const map = await this.prisma.vttMap.findUnique({
      where: { id: token.mapId },
      select: { campaignId: true },
    });
    if (!map || map.campaignId !== campaign.id) {
      throw new BadRequestException('Mapa do token não pertence à campanha.');
    }
    return this.prisma.ragnarokCharacter.update({
      where: { id: characterId },
      data: {
        saveMapId: token.mapId,
        saveX: token.x,
        saveY: token.y,
      },
      include: INCLUDE,
    });
  }

  async kafraTeleport(campaignId: string, userId: string, characterId: string) {
    await this.access(campaignId, userId);
    const link = await this.prisma.campaignRagnarokCharacter.findFirst({
      where: { campaignId, characterId },
    });
    if (!link) {
      throw new BadRequestException('Ficha não vinculada a esta campanha.');
    }
    const character = await this.prisma.ragnarokCharacter.findFirst({
      where: { id: characterId, userId },
      select: {
        id: true,
        saveMapId: true,
        saveX: true,
        saveY: true,
        maxHp: true,
        maxSp: true,
      },
    });
    if (!character) {
      throw new ForbiddenException('Esta ficha não pertence a você.');
    }
    if (
      !character.saveMapId ||
      character.saveX == null ||
      character.saveY == null
    ) {
      throw new BadRequestException('Nenhum ponto de save da Kafra.');
    }
    const token = await this.prisma.vttToken.findUnique({
      where: { ragnarokCharacterId: characterId },
      select: { id: true },
    });
    if (!token) {
      throw new BadRequestException('Entre no mapa antes de usar a Kafra.');
    }
    const map = await this.prisma.vttMap.findUnique({
      where: { id: character.saveMapId },
      select: { id: true, campaignId: true, width: true, height: true },
    });
    if (!map || map.campaignId !== campaignId) {
      throw new BadRequestException('Mapa de save inválido.');
    }
    const x = Math.max(0, Math.min(character.saveX, map.width - 1));
    const y = Math.max(0, Math.min(character.saveY, map.height - 1));
    await this.prisma.vttToken.update({
      where: { id: token.id },
      data: { mapId: map.id, x, y, visible: true },
    });
    await this.prisma.ragnarokCharacter.update({
      where: { id: characterId },
      data: {
        currentHp: character.maxHp,
        currentSp: character.maxSp,
      },
    });
    return { mapId: map.id, x, y };
  }

  async grantItem(
    campaignId: string,
    userId: string,
    characterId: string,
    dto: GrantRagnarokItemDto,
  ) {
    const campaign = await this.access(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Somente o mestre entrega itens.');
    }
    const link = await this.prisma.campaignRagnarokCharacter.findFirst({
      where: { campaignId, characterId },
    });
    if (!link) {
      throw new BadRequestException('Ficha não vinculada a esta campanha.');
    }
    const item = await this.prisma.ragnarokItem.findUnique({
      where: { id: dto.itemId },
      select: { id: true, viewKind: true, equipSlots: true },
    });
    if (!item) throw new NotFoundException('Item Ragnarok não encontrado.');
    const slot =
      item.viewKind ??
      (Array.isArray(item.equipSlots)
        ? item.equipSlots.map(String).join('/')
        : 'Geral');
    await this.prisma.ragnarokCharacterItem.upsert({
      where: {
        characterId_itemId: { characterId, itemId: item.id },
      },
      update: { quantity: { increment: dto.quantity } },
      create: {
        characterId,
        itemId: item.id,
        slot,
        equipped: false,
        quantity: dto.quantity,
      },
    });
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id: characterId },
      include: INCLUDE,
    });
  }

  async grantZeny(
    campaignId: string,
    userId: string,
    characterId: string,
    dto: GrantRagnarokZenyDto,
  ) {
    const campaign = await this.access(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Somente o mestre entrega zeny.');
    }
    const link = await this.prisma.campaignRagnarokCharacter.findFirst({
      where: { campaignId, characterId },
    });
    if (!link) {
      throw new BadRequestException('Ficha não vinculada a esta campanha.');
    }
    return this.prisma.ragnarokCharacter.update({
      where: { id: characterId },
      data: { zeny: { increment: dto.amount } },
      include: INCLUDE,
    });
  }

  async grantClass(
    campaignId: string,
    userId: string,
    characterId: string,
    dto: GrantRagnarokClassDto,
  ) {
    const campaign = await this.access(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Somente o mestre concede classe.');
    }
    const link = await this.prisma.campaignRagnarokCharacter.findFirst({
      where: { campaignId, characterId },
    });
    if (!link) {
      throw new BadRequestException('Ficha não vinculada a esta campanha.');
    }
    const job = await this.prisma.ragnarokJob.findUnique({
      where: { id: dto.jobId },
      select: { id: true, name: true, jt: true },
    });
    if (!job) throw new NotFoundException('Classe Ragnarok não encontrada.');
    if (job.id === 0) {
      throw new BadRequestException('A ficha já começa como Aprendiz.');
    }
    return this.prisma.ragnarokCharacter.update({
      where: { id: characterId },
      data: {
        jobId: job.id,
        classGrantedAt: new Date(),
        classGrantedById: userId,
      },
      include: INCLUDE,
    });
  }

  async getConfig(campaignId: string, userId: string) {
    await this.access(campaignId, userId);
    return this.prisma.ragnarokCampaignConfig.upsert({
      where: { campaignId },
      update: {},
      create: { campaignId },
    });
  }

  async updateConfig(
    campaignId: string,
    userId: string,
    dto: UpdateRagnarokConfigDto,
  ) {
    const campaign = await this.access(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Somente o mestre altera as configurações.');
    }
    return this.prisma.ragnarokCampaignConfig.upsert({
      where: { campaignId },
      update: {
        ...(dto.baseExpRate !== undefined
          ? { baseExpRate: dto.baseExpRate }
          : {}),
        ...(dto.jobExpRate !== undefined ? { jobExpRate: dto.jobExpRate } : {}),
        ...(dto.dropRate !== undefined ? { dropRate: dto.dropRate } : {}),
        ...(dto.zenyRate !== undefined ? { zenyRate: dto.zenyRate } : {}),
        ...(dto.lootMode !== undefined ? { lootMode: dto.lootMode } : {}),
        ...(dto.lootProtectionSeconds !== undefined
          ? { lootProtectionSeconds: dto.lootProtectionSeconds }
          : {}),
        updatedById: userId,
      },
      create: {
        campaignId,
        ...(dto.baseExpRate !== undefined
          ? { baseExpRate: dto.baseExpRate }
          : {}),
        ...(dto.jobExpRate !== undefined ? { jobExpRate: dto.jobExpRate } : {}),
        ...(dto.dropRate !== undefined ? { dropRate: dto.dropRate } : {}),
        ...(dto.zenyRate !== undefined ? { zenyRate: dto.zenyRate } : {}),
        ...(dto.lootMode !== undefined ? { lootMode: dto.lootMode } : {}),
        ...(dto.lootProtectionSeconds !== undefined
          ? { lootProtectionSeconds: dto.lootProtectionSeconds }
          : {}),
        updatedById: userId,
      },
    });
  }
}
