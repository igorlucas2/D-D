import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LorePackLoader,
  LorePackNotFoundError,
  LoreValidationError,
} from './lore.loader';
import type { LorePack, ResolvedBinding } from './lore.types';
import type { Prisma } from '@prisma/client';

@Injectable()
export class LoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: LorePackLoader,
  ) {}

  listPublic() {
    try {
      return this.loader.list().map(({ pack }) => ({
        packId: pack.manifest.packId,
        version: pack.manifest.version,
        status: pack.manifest.status,
        ...pack.public,
      }));
    } catch {
      // Do not disclose private paths, names, facts or counts to this audience.
      throw new ServiceUnavailableException(
        'Os cenários estão temporariamente indisponíveis.',
      );
    }
  }

  creationPreview(packId: string, version: string) {
    try {
      const { pack, contentHash } = this.loader.load(packId, version);
      return {
        packId,
        version,
        contentHash,
        status: pack.manifest.status,
        title: pack.public.title,
        warnings: pack.manifest.rules.publicationBlockers,
      };
    } catch {
      throw new UnprocessableEntityException(
        'Cenário indisponível para criação.',
      );
    }
  }

  async resolveCatalog(
    pack: LorePack,
    db: Pick<Prisma.TransactionClient, 'monster'> = this.prisma,
  ): Promise<ResolvedBinding[]> {
    const bindings = [
      ...pack.entities.npcs.map((n) => ({
        ...n.catalog,
        entityId: n.id,
        kind: 'NPC' as const,
      })),
      ...pack.encounters.map((e) => ({
        ...e.catalog,
        entityId: e.id,
        kind: 'CREATURE' as const,
      })),
    ];
    const unique = [
      ...new Map(
        bindings.map((b) => [
          `${b.source}:${b.srdIndex}`,
          { source: b.source, srdIndex: b.srdIndex },
        ]),
      ).values(),
    ];
    const rows = await db.monster.findMany({
      where: { OR: unique },
      select: { id: true, source: true, srdIndex: true, name: true },
    });
    return bindings.map((b) => {
      // Exact comparison even when the database column uses a permissive collation.
      const matches = rows.filter(
        (r) => r.source === b.source && r.srdIndex === b.srdIndex,
      );
      return {
        ...b,
        status:
          matches.length === 1
            ? 'RESOLVED'
            : matches.length
              ? 'AMBIGUOUS'
              : 'MISSING',
        monsterId: matches.length === 1 ? matches[0].id : null,
        name: matches.length === 1 ? matches[0].name : null,
      };
    });
  }

  async preview(
    campaignId: string,
    userId: string,
    packId: string,
    version: string,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        masterId: true,
        _count: true,
        worldCalendar: { select: { id: true } },
        combatEncounter: { select: { id: true } },
        lore: { select: { installedHash: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.masterId !== userId)
      throw new ForbiddenException(
        'Somente o mestre pode revisar os segredos do cenário.',
      );
    // Authorization precedes all private package and catalog reads.
    let loaded: ReturnType<LorePackLoader['load']>;
    try {
      loaded = this.loader.load(packId, version);
    } catch (error) {
      if (error instanceof LorePackNotFoundError)
        throw new NotFoundException('Cenário não encontrado.');
      if (error instanceof LoreValidationError)
        throw new UnprocessableEntityException({
          message: 'Pacote de cenário inválido.',
          issues: error.issues,
        });
      throw error;
    }
    const { pack, contentHash } = loaded;
    const bindings = await this.resolveCatalog(pack);
    const occupied =
      Object.entries(campaign._count).some(([key, count]) =>
        key === 'members' ? count > 1 : count > 0,
      ) ||
      campaign.worldCalendar !== null ||
      campaign.combatEncounter !== null;
    const conflicts = bindings
      .filter((b) => b.status !== 'RESOLVED')
      .map((b) => ({
        code: `CATALOG_${b.status}`,
        message: `Ficha de ${b.entityId}: ${b.source}/${b.srdIndex} ${b.status === 'MISSING' ? 'não encontrada' : 'ambígua'}.`,
      }));
    if (occupied)
      conflicts.push({
        code: 'CAMPAIGN_NOT_EMPTY',
        message:
          'Esta campanha já tem participantes ou conteúdo. O cenário exige uma campanha nova e vazia; esta prévia não altera a história existente.',
      });
    return {
      campaign: { id: campaign.id, name: campaign.name },
      pack: {
        packId,
        version,
        status: pack.manifest.status,
        contentHash,
        ...pack.public,
      },
      validation: {
        catalogValid: bindings.every((b) => b.status === 'RESOLVED'),
        campaignEligible: !occupied,
        canInstall:
          !occupied &&
          bindings.every((b) => b.status === 'RESOLVED') &&
          pack.manifest.status === 'PUBLISHED',
        canInstallPlaytest:
          !occupied &&
          bindings.every((b) => b.status === 'RESOLVED') &&
          pack.manifest.status === 'DRAFT',
        installedHash: campaign.lore?.installedHash ?? null,
        conflicts,
        warnings: [
          ...(pack.manifest.status === 'DRAFT'
            ? [
                'Rascunho disponível para campanha de teste com condução humana.',
              ]
            : []),
          ...pack.manifest.rules.publicationBlockers,
        ],
      },
      counts: {
        npcs: pack.entities.npcs.length,
        creatures: pack.encounters.length,
        places: pack.entities.places.length,
        factions: pack.entities.factions.length,
        facts: pack.facts.facts.length,
        threads: pack.threads.threads.length,
        maps: pack.atlas.maps.length,
      },
      bindings,
      sources: pack.manifest.sources,
      rules: pack.manifest.rules,
      review: {
        entities: pack.entities,
        facts: pack.facts,
        history: pack.history,
        threads: pack.threads,
        encounters: pack.encounters,
        atlas: pack.atlas,
      },
    };
  }
}
