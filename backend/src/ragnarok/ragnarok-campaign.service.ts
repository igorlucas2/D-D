import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GrantRagnarokClassDto } from './dto/grant-ragnarok-class.dto';
import { UpdateRagnarokConfigDto } from './dto/update-ragnarok-config.dto';

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
