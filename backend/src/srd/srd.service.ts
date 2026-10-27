import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseJson } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SrdService {
  constructor(private readonly prisma: PrismaService) {}

  async listEndpoints() {
    const groups = await this.prisma.srdResource.groupBy({
      by: ['endpoint'],
      _count: { endpoint: true },
      orderBy: { endpoint: 'asc' },
    });

    return groups.map((group) => ({
      endpoint: group.endpoint,
      count: group._count.endpoint,
    }));
  }

  async listResources(
    endpoint?: string,
    search?: string,
    options: { take?: number; cursor?: string } = {},
  ) {
    const where: Prisma.SrdResourceWhereInput = {};
    if (endpoint) where.endpoint = endpoint;
    if (search) {
      where.name = { contains: search };
    }

    const take = Math.min(Math.max(options.take ?? 50, 1), 100);

    const rows = await this.prisma.srdResource.findMany({
      where,
      orderBy: [{ endpoint: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        endpoint: true,
        index: true,
        name: true,
        url: true,
        source: true,
        srdUpdatedAt: true,
        importedAt: true,
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async getResource(endpoint: string, index: string) {
    const resource = await this.prisma.srdResource.findUnique({
      where: { endpoint_index: { endpoint, index } },
    });

    if (!resource) return null;

    return {
      ...resource,
      data: parseJson(resource.data),
    };
  }
}
