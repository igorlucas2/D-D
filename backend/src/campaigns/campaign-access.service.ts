import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContextService } from '../common/request-context.service';
import { PrismaService } from '../prisma/prisma.service';

export type CampaignAccessCampaign = Prisma.CampaignGetPayload<{
  include: {
    members: { select: { userId: true } };
  };
}>;

export interface CampaignAccessMessages {
  notFound?: string;
  forbidden?: string;
  master?: string;
}

/**
 * Fonte única de autorização por campanha.
 *
 * A consulta inclui mestre e membros em uma única ida ao banco e fica em cache
 * durante a requisição: guardas, serviços e helpers que verificam a mesma
 * campanha reutilizam o resultado em vez de repetir o SELECT. Sem contexto de
 * requisição (WebSocket, jobs), cada chamada consulta normalmente.
 */
@Injectable()
export class CampaignAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: RequestContextService,
  ) {}

  member(
    campaignId: string,
    userId: string,
    messages: CampaignAccessMessages = {},
  ): Promise<CampaignAccessCampaign> {
    return this.load(campaignId, userId, messages);
  }

  async master(
    campaignId: string,
    userId: string,
    messages: CampaignAccessMessages = {},
  ): Promise<CampaignAccessCampaign> {
    const campaign = await this.load(campaignId, userId, messages);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException(
        messages.master ?? 'Apenas o mestre pode realizar esta ação.',
      );
    }
    return campaign;
  }

  private load(
    campaignId: string,
    userId: string,
    messages: CampaignAccessMessages,
  ): Promise<CampaignAccessCampaign> {
    const key = `campaign-access:${campaignId}:${userId}`;
    const cached = this.context.get<Promise<CampaignAccessCampaign>>(key);
    if (cached) return cached;

    const pending = this.fetch(campaignId, userId, messages);
    this.context.set(key, pending);
    return pending.catch((error: unknown) => {
      this.context.delete(key);
      throw error;
    });
  }

  private async fetch(
    campaignId: string,
    userId: string,
    messages: CampaignAccessMessages,
  ): Promise<CampaignAccessCampaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!campaign) {
      throw new NotFoundException(
        messages.notFound ?? 'Campanha não encontrada.',
      );
    }

    const isMember =
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException(
        messages.forbidden ?? 'Você não tem acesso a esta campanha.',
      );
    }

    return campaign;
  }
}
