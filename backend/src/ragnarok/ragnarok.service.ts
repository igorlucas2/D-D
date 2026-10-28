import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_TAKE = 500;

function paging(take?: string, skip?: string) {
  const parsedTake = Number.parseInt(take ?? '', 10);
  const parsedSkip = Number.parseInt(skip ?? '', 10);
  return {
    take: Number.isFinite(parsedTake)
      ? Math.min(MAX_TAKE, Math.max(1, parsedTake))
      : 100,
    skip: Number.isFinite(parsedSkip) ? Math.max(0, parsedSkip) : 0,
  };
}

@Injectable()
export class RagnarokService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [jobs, skills, items, maps, costumes] = await Promise.all([
      this.prisma.ragnarokJob.count(),
      this.prisma.ragnarokSkill.count(),
      this.prisma.ragnarokItem.count(),
      this.prisma.ragnarokMap.count(),
      this.prisma.ragnarokItem.count({ where: { costume: true } }),
    ]);
    return { jobs, skills, items, maps, costumes };
  }

  async listJobs(search?: string) {
    return this.prisma.ragnarokJob.findMany({
      where: search
        ? {
            OR: [{ name: { contains: search } }, { jt: { contains: search } }],
          }
        : undefined,
      orderBy: { id: 'asc' },
    });
  }

  async listSkills(search?: string, take?: string, skip?: string) {
    const { take: limit, skip: offset } = paging(take, skip);
    return this.prisma.ragnarokSkill.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { id: 'asc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        maxLevel: true,
        delay: true,
        description: true,
      },
    });
  }

  async listItems(
    search?: string,
    take?: string,
    skip?: string,
    costume?: string,
  ) {
    const { take: limit, skip: offset } = paging(take, skip);
    return this.prisma.ragnarokItem.findMany({
      where: {
        ...(costume === 'true' ? { costume: true } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { aegisName: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        slots: true,
        aegisName: true,
        resourceName: true,
        view: true,
        costume: true,
        equipSlots: true,
      },
    });
  }

  async listMaps(search?: string) {
    return this.prisma.ragnarokMap.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { name: 'asc' },
      take: 500,
    });
  }
}
