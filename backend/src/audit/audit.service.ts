import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditRecordInput {
  campaignId?: string | null;
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue;
  requestId?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
  ) {}

  record(input: AuditRecordInput) {
    return this.prisma.auditLog.create({
      data: {
        campaignId: input.campaignId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata,
        requestId: input.requestId ?? null,
      },
    });
  }

  async list(
    campaignId: string,
    userId: string,
    options: { take?: number; cursor?: string } = {},
  ) {
    await this.access.master(campaignId, userId);

    const requested = options.take ?? 50;
    const take = Math.min(
      Math.max(Number.isFinite(requested) ? Math.trunc(requested) : 50, 1),
      100,
    );
    const rows = await this.prisma.auditLog.findMany({
      where: { campaignId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }
}
