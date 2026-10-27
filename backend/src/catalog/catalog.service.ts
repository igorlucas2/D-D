import { Injectable } from '@nestjs/common';
import { parseJsonArray } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';

export interface CatalogFeature {
  name: string;
  description: string;
}

function parseFeatures(value: string | null): CatalogFeature[] {
  return parseJsonArray(value).filter((feature): feature is CatalogFeature => {
    if (!feature || typeof feature !== 'object') return false;
    const candidate = feature as Record<string, unknown>;
    return (
      typeof candidate.name === 'string' &&
      typeof candidate.description === 'string'
    );
  });
}

const CATALOG_LIMIT = 500;

/** Lista curta o suficiente para uma resposta; o resto pede paginação. */
function clampTake(take?: number): number {
  if (take === undefined || !Number.isFinite(take)) return CATALOG_LIMIT;
  return Math.min(Math.max(Math.trunc(take), 1), CATALOG_LIMIT);
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(take?: number) {
    return this.prisma.item.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: clampTake(take),
    });
  }

  async listSpells(take?: number) {
    return this.prisma.spell.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: clampTake(take),
    });
  }

  async listMonsters(take?: number) {
    const monsters = await this.prisma.monster.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: clampTake(take),
    });

    return monsters.map((monster) => ({
      ...monster,
      traits: parseFeatures(monster.traits),
      actions: parseFeatures(monster.actions),
    }));
  }

  async listRules(take?: number) {
    return this.prisma.ruleSection.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: clampTake(take),
    });
  }
}
