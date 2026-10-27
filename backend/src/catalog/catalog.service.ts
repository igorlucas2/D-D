import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CatalogFeature {
  name: string;
  description: string;
}

function parseFeatures(value: string | null): CatalogFeature[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((feature): feature is CatalogFeature => {
      if (!feature || typeof feature !== 'object') return false;
      const candidate = feature as Record<string, unknown>;
      return (
        typeof candidate.name === 'string' &&
        typeof candidate.description === 'string'
      );
    });
  } catch {
    return [];
  }
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems() {
    return this.prisma.item.findMany({ orderBy: { name: 'asc' } });
  }

  async listSpells() {
    return this.prisma.spell.findMany({ orderBy: { name: 'asc' } });
  }

  async listMonsters() {
    const monsters = await this.prisma.monster.findMany({
      orderBy: { name: 'asc' },
    });

    return monsters.map((monster) => ({
      ...monster,
      traits: parseFeatures(monster.traits),
      actions: parseFeatures(monster.actions),
    }));
  }

  async listRules() {
    return this.prisma.ruleSection.findMany({ orderBy: { name: 'asc' } });
  }
}
