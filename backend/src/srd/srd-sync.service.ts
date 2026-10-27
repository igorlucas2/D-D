import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  asRecord,
  mapEquipment,
  mapMonster,
  mapRuleSection,
  mapSpell,
  parseSrdDate,
  stringField,
} from './srd-mappers';
import type {
  SrdListResponse,
  SrdReference,
  SrdSyncEndpointResult,
  SrdSyncResult,
} from './srd.types';

const API_ORIGIN = 'https://www.dnd5eapi.co';
const API_BASE = `${API_ORIGIN}/api`;
const SOURCE = 'dnd5eapi-2014';
const MAPPED_ENDPOINTS = new Set([
  'equipment',
  'magic-items',
  'monsters',
  'spells',
  'rule-sections',
]);

@Injectable()
export class SrdSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncAll(requestedEndpoints?: string[]): Promise<SrdSyncResult> {
    const endpoints = await this.fetchEndpoints();
    const selected = requestedEndpoints?.length
      ? Object.entries(endpoints).filter(([endpoint]) =>
          requestedEndpoints.includes(endpoint),
        )
      : Object.entries(endpoints);

    const results: SrdSyncEndpointResult[] = [];

    for (const [endpoint, url] of selected) {
      results.push(await this.syncEndpoint(endpoint, url));
    }

    return {
      source: SOURCE,
      endpoints: results,
      imported: results.reduce((total, result) => total + result.imported, 0),
    };
  }

  async fetchEndpoints() {
    return this.fetchJson<Record<string, string>>(API_BASE);
  }

  // Reaplica os mappers sobre os dados já cacheados em SrdResource,
  // sem precisar buscar novamente na API externa.
  async resyncFromCache(requestedEndpoints?: string[]): Promise<SrdSyncResult> {
    const endpoints = requestedEndpoints?.length
      ? requestedEndpoints.filter((endpoint) => MAPPED_ENDPOINTS.has(endpoint))
      : Array.from(MAPPED_ENDPOINTS);

    const results: SrdSyncEndpointResult[] = [];

    for (const endpoint of endpoints) {
      const resources = await this.prisma.srdResource.findMany({
        where: { endpoint, source: SOURCE },
      });

      let imported = 0;
      for (const resource of resources) {
        const detail = JSON.parse(resource.data) as unknown;
        await this.upsertMappedResource(endpoint, detail);
        imported += 1;
      }

      results.push({ endpoint, total: resources.length, imported });
    }

    return {
      source: SOURCE,
      endpoints: results,
      imported: results.reduce((total, result) => total + result.imported, 0),
    };
  }

  private async syncEndpoint(
    endpoint: string,
    url: string,
  ): Promise<SrdSyncEndpointResult> {
    const list = await this.fetchJson<SrdListResponse>(this.absoluteUrl(url));
    const resources = list.results ?? [];
    let imported = 0;

    for (const resource of resources) {
      const detail = await this.fetchResource(resource);
      await this.upsertResource(endpoint, resource, detail);
      if (MAPPED_ENDPOINTS.has(endpoint)) {
        await this.upsertMappedResource(endpoint, detail);
      }
      imported += 1;
    }

    return {
      endpoint,
      total: list.count ?? resources.length,
      imported,
    };
  }

  private async fetchResource(resource: SrdReference) {
    return this.fetchJson<unknown>(this.absoluteUrl(resource.url));
  }

  private async upsertResource(
    endpoint: string,
    resource: SrdReference,
    detail: unknown,
  ) {
    const detailRecord = asRecord(detail);
    const name = detailRecord
      ? stringField(detailRecord, 'name', resource.name)
      : resource.name;
    const url = detailRecord
      ? stringField(detailRecord, 'url', resource.url)
      : resource.url;
    const srdUpdatedAt = detailRecord ? parseSrdDate(detailRecord) : null;

    await this.prisma.srdResource.upsert({
      where: { endpoint_index: { endpoint, index: resource.index } },
      create: {
        endpoint,
        index: resource.index,
        name,
        url: this.absoluteUrl(url),
        source: SOURCE,
        data: JSON.stringify(detail),
        srdUpdatedAt,
      },
      update: {
        name,
        url: this.absoluteUrl(url),
        source: SOURCE,
        data: JSON.stringify(detail),
        srdUpdatedAt,
      },
    });
  }

  private async upsertMappedResource(endpoint: string, detail: unknown) {
    const detailRecord = asRecord(detail);
    if (!detailRecord) return;

    if (endpoint === 'monsters') {
      const data = mapMonster(detailRecord);
      await this.upsertMonster(data);
      return;
    }

    if (endpoint === 'spells') {
      const data = mapSpell(detailRecord);
      await this.upsertSpell(data);
      return;
    }

    if (endpoint === 'equipment' || endpoint === 'magic-items') {
      const data = mapEquipment(detailRecord, endpoint);
      await this.upsertItem(data);
      return;
    }

    if (endpoint === 'rule-sections') {
      const data = mapRuleSection(detailRecord);
      await this.upsertRuleSection(data);
    }
  }

  private async upsertMonster(data: Prisma.MonsterUncheckedCreateInput) {
    const existing = data.srdIndex
      ? await this.prisma.monster.findFirst({
          where: { OR: [{ srdIndex: data.srdIndex }, { name: data.name }] },
        })
      : null;

    if (existing) {
      await this.prisma.monster.update({ where: { id: existing.id }, data });
      return;
    }

    await this.prisma.monster.create({ data });
  }

  private async upsertSpell(data: Prisma.SpellUncheckedCreateInput) {
    const existing = data.srdIndex
      ? await this.prisma.spell.findFirst({
          where: { OR: [{ srdIndex: data.srdIndex }, { name: data.name }] },
        })
      : null;

    if (existing) {
      await this.prisma.spell.update({ where: { id: existing.id }, data });
      return;
    }

    await this.prisma.spell.create({ data });
  }

  private async upsertItem(data: Prisma.ItemUncheckedCreateInput) {
    const existing = data.srdIndex
      ? await this.prisma.item.findFirst({
          where: { OR: [{ srdIndex: data.srdIndex }, { name: data.name }] },
        })
      : null;

    if (existing) {
      await this.prisma.item.update({ where: { id: existing.id }, data });
      return;
    }

    await this.prisma.item.create({ data });
  }

  private async upsertRuleSection(
    data: Prisma.RuleSectionUncheckedCreateInput,
  ) {
    const existing = data.srdIndex
      ? await this.prisma.ruleSection.findFirst({
          where: { OR: [{ srdIndex: data.srdIndex }, { name: data.name }] },
        })
      : null;

    if (existing) {
      await this.prisma.ruleSection.update({
        where: { id: existing.id },
        data,
      });
      return;
    }

    await this.prisma.ruleSection.create({ data });
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `SRD request failed: ${response.status} ${response.statusText} (${url})`,
      );
    }

    const data: unknown = await response.json();
    return data as T;
  }

  private absoluteUrl(url: string) {
    if (url.startsWith('http')) return url;
    return `${API_ORIGIN}${url}`;
  }
}
