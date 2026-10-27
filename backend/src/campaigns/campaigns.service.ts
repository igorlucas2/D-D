import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignAccessService } from './campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { deleteCampaignLore } from '../lore/delete-lore';
import { VttGateway } from '../vtt/vtt.gateway';
import { WorldGateway } from '../world/world.gateway';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JoinCampaignDto } from './dto/join-campaign.dto';

const MEMBER_USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

const CAMPAIGN_INCLUDE = {
  master: { select: MEMBER_USER_SELECT },
  members: {
    include: { user: { select: MEMBER_USER_SELECT } },
    orderBy: { joinedAt: 'asc' },
  },
} as const;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly vttGateway: VttGateway,
    private readonly worldGateway: WorldGateway,
  ) {}

  async findAllForUser(userId: string) {
    return this.prisma.campaign.findMany({
      where: {
        OR: [{ masterId: userId }, { members: { some: { userId } } }],
      },
      include: CAMPAIGN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        masterId: userId,
        members: {
          create: { userId, role: 'MASTER' },
        },
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async findOne(id: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: CAMPAIGN_INCLUDE,
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (!this.isMember(campaign, userId)) {
      throw new ForbiddenException('Você não tem acesso a esta campanha.');
    }

    return campaign;
  }

  async update(id: string, userId: string, dto: UpdateCampaignDto) {
    await this.assertIsMaster(id, userId);

    return this.prisma.campaign.update({
      where: { id },
      data: dto,
      include: CAMPAIGN_INCLUDE,
    });
  }

  async remove(id: string, userId: string) {
    await this.assertIsMaster(id, userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${id} FOR UPDATE`;
      await deleteCampaignLore(tx, id);
      await tx.campaign.delete({ where: { id } });
    });
    await this.vttGateway.closeCampaign(id);
    this.worldGateway.closeCampaign(id);
    return { success: true };
  }

  async join(userId: string, dto: JoinCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { inviteCode: dto.inviteCode },
      include: CAMPAIGN_INCLUDE,
    });

    if (!campaign) {
      throw new NotFoundException('Convite inválido.');
    }
    if (this.isMember(campaign, userId)) {
      return campaign;
    }

    await this.prisma.campaignMember.create({
      data: { campaignId: campaign.id, userId, role: 'PLAYER' },
    });

    return this.prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async leave(id: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (campaign.masterId === userId) {
      throw new ForbiddenException(
        'O mestre não pode sair da campanha. Exclua a campanha em vez disso.',
      );
    }

    await this.prisma.campaignMember.deleteMany({
      where: { campaignId: id, userId },
    });
    await this.revokeRealtime(id, userId);

    return { success: true };
  }

  async removeMember(
    id: string,
    memberUserId: string,
    requesterUserId: string,
  ) {
    const campaign = await this.assertIsMaster(id, requesterUserId);

    if (memberUserId === campaign.masterId) {
      throw new ForbiddenException(
        'O mestre não pode ser removido da campanha.',
      );
    }

    await this.prisma.campaignMember.deleteMany({
      where: { campaignId: id, userId: memberUserId },
    });
    await this.revokeRealtime(id, memberUserId);

    return { success: true };
  }

  /** Quem deixa a campanha para de receber mesa e relogio imediatamente. */
  private async revokeRealtime(campaignId: string, userId: string) {
    await Promise.all([
      this.vttGateway.evictUser(campaignId, userId),
      this.worldGateway.evictUser(campaignId, userId),
    ]);
  }

  private isMember(
    campaign: { masterId: string; members: { userId: string }[] },
    userId: string,
  ) {
    return (
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId)
    );
  }

  private async assertIsMaster(id: string, userId: string) {
    return this.access.master(id, userId, {
      forbidden: 'Apenas o mestre pode realizar esta ação.',
      master: 'Apenas o mestre pode realizar esta ação.',
    });
  }
}
