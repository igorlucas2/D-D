import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { totalMinutesFromFields } from '../world/world.service';
import {
  LorePackLoader,
  LorePackNotFoundError,
  LoreValidationError,
  sha256,
} from './lore.loader';
import { LoreService } from './lore.service';
import type { LorePack } from './lore.types';
import { seedStory } from '../story/story.seed';
import { initializeDomain } from '../game-actions/object-facts';

export interface InstallLoreInput {
  packId: string;
  version: string;
  expectedHash: string;
  allowDraft?: boolean;
}
export interface CreateLoreCampaignInput extends InstallLoreInput {
  name: string;
  description?: string;
  requestKey: string;
}
type Tx = Prisma.TransactionClient;

@Injectable()
export class LoreInstallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: LorePackLoader,
    private readonly lore: LoreService,
  ) {}

  private load(input: InstallLoreInput) {
    try {
      const loaded = this.loader.load(input.packId, input.version);
      if (loaded.contentHash !== input.expectedHash)
        throw new ConflictException(
          'O cenário mudou desde a prévia. Revise a versão atual.',
        );
      if (loaded.pack.manifest.status === 'DRAFT' && !input.allowDraft)
        throw new ConflictException(
          'Este cenário é um rascunho. Confirme a criação de uma campanha de teste.',
        );
      return loaded;
    } catch (error) {
      if (error instanceof LorePackNotFoundError)
        throw new NotFoundException('Cenário não encontrado.');
      if (error instanceof LoreValidationError)
        throw new UnprocessableEntityException({
          message: 'Pacote inválido.',
          issues: error.issues,
        });
      throw error;
    }
  }

  private async transaction<T>(action: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(action, {
          isolationLevel: 'Serializable',
          maxWait: 10000,
          timeout: 30000,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'Outra operação alterou a campanha. Consulte o estado e tente novamente.',
          );
        }
        throw error;
      }
    }
  }

  async create(userId: string, input: CreateLoreCampaignInput) {
    const name = input.name.trim();
    if (!name)
      throw new BadRequestException('Informe um nome para a campanha.');
    const requestHash = sha256(
      JSON.stringify({
        name,
        description: input.description?.trim() || null,
        packId: input.packId,
        version: input.version,
        expectedHash: input.expectedHash,
        allowDraft: input.allowDraft === true,
      }),
    );
    // First check replays against the installed snapshot, even if source files later disappear.
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
      const previous = await tx.campaignLore.findUnique({
        where: {
          installedById_requestKey: {
            installedById: userId,
            requestKey: input.requestKey,
          },
        },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new ConflictException(
            'Chave de criação já usada com outros dados.',
          );
        return this.receipt(tx, previous.campaignId, true);
      }
      const loaded = this.load(input);
      const campaign = await tx.campaign.create({
        data: {
          name,
          description: input.description?.trim() || null,
          masterId: userId,
          members: { create: { userId, role: 'MASTER' } },
        },
      });
      return this.seed(tx, campaign.id, userId, input, loaded, {
        requestKey: input.requestKey,
        requestHash,
      });
    });
  }

  async install(campaignId: string, userId: string, input: InstallLoreInput) {
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${campaignId} FOR UPDATE`;
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: {
          masterId: true,
          _count: true,
          worldCalendar: { select: { id: true } },
          combatEncounter: { select: { id: true } },
          lore: true,
        },
      });
      if (!campaign) throw new NotFoundException('Campanha não encontrada.');
      if (campaign.masterId !== userId)
        throw new ForbiddenException(
          'Somente o mestre pode instalar o cenário.',
        );
      if (campaign.lore) {
        const stored = await tx.lorePackVersion.findUniqueOrThrow({
          where: { id: campaign.lore.packVersionId },
        });
        if (
          stored.packKey !== input.packId ||
          stored.version !== input.version ||
          campaign.lore.installedHash !== input.expectedHash
        )
          throw new ConflictException(
            'A campanha já usa outro cenário ou revisão.',
          );
        return this.receipt(tx, campaignId, true);
      }
      if (
        campaign.worldCalendar ||
        campaign.combatEncounter ||
        Object.entries(campaign._count).some(([key, count]) =>
          key === 'members' ? count > 1 : count > 0,
        )
      )
        throw new ConflictException(
          'A instalação exige uma campanha nova e vazia.',
        );
      return this.seed(tx, campaignId, userId, input, this.load(input));
    });
  }

  private async seed(
    tx: Tx,
    campaignId: string,
    userId: string,
    input: InstallLoreInput,
    loaded: ReturnType<LorePackLoader['load']>,
    request: { requestKey?: string; requestHash?: string } = {},
  ) {
    const { pack, contentHash, textures } = loaded;
    const bindings = await this.lore.resolveCatalog(pack, tx);
    if (bindings.some((b) => b.status !== 'RESOLVED'))
      throw new ConflictException(
        'Catálogo incompleto ou ambíguo. Revise as fichas antes de instalar.',
      );
    const monsters = await tx.monster.findMany({
      where: { id: { in: bindings.map((b) => b.monsterId!) } },
    });
    let stored = await tx.lorePackVersion.findUnique({
      where: {
        packKey_version: { packKey: input.packId, version: input.version },
      },
    });
    if (stored && stored.contentHash !== contentHash)
      throw new ConflictException(
        'Esta versão já foi instalada com outro conteúdo. Crie uma nova versão do pacote.',
      );
    if (!stored)
      stored = await tx.lorePackVersion.create({
        data: {
          packKey: input.packId,
          version: input.version,
          contentHash,
          status: pack.manifest.status,
          formatVersion: pack.manifest.formatVersion,
          snapshot: JSON.stringify(pack),
        },
      });
    await tx.campaignLore.create({
      data: {
        campaignId,
        packVersionId: stored.id,
        installedById: userId,
        installedHash: contentHash,
        catalogSnapshots: JSON.stringify(monsters),
        playtest: pack.manifest.status === 'DRAFT',
        mode: 'OFF',
        ...request,
      },
    });
    const ids = new Map<string, string>();
    for (const [kind, rows] of [
      ['PLACE', pack.entities.places],
      ['FACTION', pack.entities.factions],
      ['NPC', pack.entities.npcs],
      ['OBJECT', pack.entities.objects],
    ] as const) {
      for (const row of rows) {
        const id = randomUUID();
        ids.set(row.id, id);
        await tx.campaignEntity.create({
          data: {
            id,
            campaignId,
            key: row.id,
            templateKey: row.id,
            kind,
            name: row.name,
          },
        });
      }
    }
    const maps = new Map(pack.atlas.maps.map((m) => [m.id, randomUUID()]));
    // Create all maps first, then wire the hierarchy. No ordering dependency in the package.
    for (const m of pack.atlas.maps) {
      const mapId = maps.get(m.id)!;
      const geometry = pack.atlas.geometry.find((g) => g.mapId === m.id);
      await tx.vttMap.create({
        data: {
          id: mapId,
          campaignId,
          name: m.name,
          kind: m.kind,
          width: m.width,
          height: m.height,
          gridSize: m.gridSize,
          imageUrl: `/api/campaigns/${campaignId}/lore/maps/${mapId}/image`,
          published: m.visibility === 'PUBLIC_AT_START',
          vision: 'OFF',
          lightingMode: m.kind === 'INTERIOR' ? 'INDOOR' : 'AUTO',
          wallsData: geometry ? JSON.stringify(geometry.walls) : null,
        },
      });
      const texture = textures.get(m.id)!;
      await tx.campaignLoreMap.create({
        data: {
          mapId,
          campaignId,
          key: m.id,
          texture: new Uint8Array(texture),
          textureHash: sha256(texture),
        },
      });
    }
    for (const m of pack.atlas.maps)
      if (m.parentId)
        await tx.vttMap.update({
          where: { id: maps.get(m.id)! },
          data: { parentMapId: maps.get(m.parentId)! },
        });
    for (const point of pack.atlas.places)
      await tx.vttMapHotspot.create({
        data: {
          mapId: maps.get(point.mapId)!,
          x: point.x,
          y: point.y,
          label: point.name,
          targetMapId: point.targetMapId ? maps.get(point.targetMapId)! : null,
          travelActionCost: 0,
          travelMinutes: 0,
          visibleToPlayers: true,
        },
      });
    for (const place of pack.entities.places) {
      const point = pack.atlas.places.find((p) => p.id === place.id);
      const room = pack.atlas.rooms.find((r) => r.id === place.id);
      const mapKey = point?.targetMapId ?? point?.mapId ?? room?.mapId;
      await tx.campaignPlace.create({
        data: {
          campaignId,
          entityId: ids.get(place.id)!,
          description: place.description,
          mapId: mapKey ? maps.get(mapKey) : null,
        },
      });
    }
    for (const place of pack.entities.places)
      if (place.parentId)
        await tx.campaignPlace.update({
          where: { entityId: ids.get(place.id)! },
          data: { parentEntityId: ids.get(place.parentId)! },
        });
    for (const f of pack.entities.factions)
      await tx.campaignFaction.create({
        data: {
          campaignId,
          entityId: ids.get(f.id)!,
          objective: f.objective,
          limits: f.limits,
        },
      });
    for (const npc of pack.entities.npcs) {
      const binding = bindings.find(
        (b) => b.kind === 'NPC' && b.entityId === npc.id,
      )!;
      const monster = monsters.find((m) => m.id === binding.monsterId)!;
      await tx.campaignNpc.create({
        data: {
          campaignId,
          entityId: ids.get(npc.id)!,
          placeEntityId: ids.get(npc.placeId)!,
          factionEntityId: npc.factionId ? ids.get(npc.factionId) : null,
          catalogSource: npc.catalog.source,
          catalogIndex: npc.catalog.srdIndex,
          catalogSnapshot: JSON.stringify(monster),
          objective: npc.objective,
          voice: npc.voice,
          maxHp: monster.maxHp,
          currentHp: monster.maxHp,
          conditions: '[]',
        },
      });
    }
    for (const obj of pack.entities.objects)
      await tx.campaignPlotObject.create({
        data: {
          campaignId,
          entityId: ids.get(obj.id)!,
          placeEntityId: ids.get(obj.placeId)!,
          state: obj.state,
        },
      });
    for (const route of [...pack.atlas.routes, ...pack.atlas.localTravel]) {
      for (const [from, to] of [
        [route.from, route.to],
        [route.to, route.from],
      ])
        await tx.travelRoute.create({
          data: {
            campaignId,
            fromEntityId: ids.get(from)!,
            toEntityId: ids.get(to)!,
            minutes: route.minutes,
          },
        });
    }
    const start = pack.public.start;
    const daysPerMonth = Array<number>(12).fill(30);
    await tx.campaignCalendar.create({
      data: {
        campaignId,
        monthNames: JSON.stringify([
          'Bruma',
          'Gelo',
          'Degelo',
          'Broto',
          'Flor',
          'Sol Alto',
          'Estio',
          'Colheita',
          'Âmbar',
          'Cinza',
          'Geada',
          'Vigília',
        ]),
        daysPerMonth: JSON.stringify(daysPerMonth),
        weekdayNames: JSON.stringify(
          Array.from({ length: 7 }, (_, i) => `Dia ${i + 1}`),
        ),
        currentYear: start.year,
        currentMonth: start.month,
        currentDay: start.day,
        currentHour: start.hour,
        currentMinute: start.minute,
        totalMinutes: totalMinutesFromFields(
          start.day,
          start.month,
          start.year,
          start.hour,
          start.minute,
          daysPerMonth,
        ),
        realMinutesPerTick: 0,
      },
    });
    await tx.sceneState.create({
      data: { campaignId, placeEntityId: ids.get('cais')! },
    });
    await seedStory(tx, campaignId);
    await initializeDomain(tx, campaignId);
    return this.receipt(tx, campaignId, false);
  }

  private async receipt(tx: Tx, campaignId: string, alreadyInstalled: boolean) {
    const lore = await tx.campaignLore.findUniqueOrThrow({
      where: { campaignId },
      include: {
        packVersion: { select: { packKey: true, version: true } },
        maps: {
          select: {
            key: true,
            map: { select: { id: true, name: true, published: true } },
          },
        },
      },
    });
    return {
      campaignId,
      packId: lore.packVersion.packKey,
      version: lore.packVersion.version,
      installedHash: lore.installedHash,
      playtest: lore.playtest,
      mode: lore.mode,
      alreadyInstalled,
      maps: lore.maps.map((m) => ({ key: m.key, ...m.map })),
    };
  }

  private async member(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { masterId: true, members: { select: { userId: true } } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (
      campaign.masterId !== userId &&
      !campaign.members.some((m) => m.userId === userId)
    )
      throw new ForbiddenException('Sem acesso à campanha.');
    return campaign;
  }

  async state(campaignId: string, userId: string) {
    const campaign = await this.member(campaignId, userId);
    const lore = await this.prisma.campaignLore.findUnique({
      where: { campaignId },
      include: {
        packVersion: true,
        maps: {
          select: {
            key: true,
            map: {
              select: { id: true, name: true, published: true, imageUrl: true },
            },
          },
        },
      },
    });
    if (!lore) return { installed: false };
    const scene = await this.prisma.sceneState.findUniqueOrThrow({
      where: { campaignId },
      include: {
        place: {
          include: {
            entity: true,
            map: { select: { map: { select: { id: true, published: true } } } },
          },
        },
        participants: {
          include: {
            character: { select: { id: true, name: true, userId: true } },
          },
        },
      },
    });
    const shared = {
      installed: true,
      packId: lore.packVersion.packKey,
      version: lore.packVersion.version,
      playtest: lore.playtest,
      mode: lore.mode,
      ...(campaign.masterId === userId ? { revision: lore.revision } : {}),
      scene: {
        place: { id: scene.place.entityId, name: scene.place.entity.name },
        mapId:
          scene.place.map?.map.published || campaign.masterId === userId
            ? scene.place.mapId
            : null,
        participants: scene.participants
          .filter(
            (p) =>
              campaign.members.some((m) => m.userId === p.character.userId) ||
              p.character.userId === campaign.masterId,
          )
          .map((p) => p.character),
      },
    };
    if (campaign.masterId !== userId) return shared;
    const entities = await this.prisma.campaignEntity.findMany({
      where: { campaignId },
      include: { npc: true, place: true, faction: true, plotObject: true },
      orderBy: { key: 'asc' },
    });
    const routes = await this.prisma.travelRoute.findMany({
      where: { campaignId },
    });
    // Installed snapshot, independent of the currently bundled/editorial package.
    const snapshot = JSON.parse(lore.packVersion.snapshot) as LorePack;
    return {
      ...shared,
      installedHash: lore.installedHash,
      entities,
      routes,
      maps: lore.maps.map((m) => ({ key: m.key, ...m.map })),
      review: snapshot,
    };
  }

  async image(campaignId: string, mapId: string, userId: string) {
    const campaign = await this.member(campaignId, userId);
    const asset = await this.prisma.campaignLoreMap.findUnique({
      where: { campaignId_mapId: { campaignId, mapId } },
      include: { map: { select: { published: true } } },
    });
    if (!asset || (!asset.map.published && campaign.masterId !== userId))
      throw new NotFoundException('Mapa não encontrado.');
    const buffer = Buffer.from(asset.texture);
    if (sha256(buffer) !== asset.textureHash)
      throw new UnprocessableEntityException('Imagem do cenário indisponível.');
    return buffer;
  }

  async attachCharacter(
    campaignId: string,
    userId: string,
    characterId: string,
  ) {
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${campaignId} FOR UPDATE`;
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        include: { members: true, lore: true },
      });
      if (!campaign?.lore)
        throw new NotFoundException('Cenário não instalado.');
      if (
        campaign.masterId !== userId &&
        !campaign.members.some((m) => m.userId === userId)
      )
        throw new ForbiddenException('Sem acesso à campanha.');
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: { loreCharacter: true, explorationState: true },
      });
      if (!character || character.userId !== userId)
        throw new ForbiddenException('Escolha um personagem seu.');
      if (character.loreCharacter?.campaignId === campaignId)
        return { entityId: character.loreCharacter.entityId, characterId };
      if (
        character.loreCharacter ||
        (character.explorationState &&
          character.explorationState.campaignId !== campaignId) ||
        (await tx.vttToken.findFirst({
          where: { characterId, map: { campaignId: { not: campaignId } } },
        })) ||
        (await tx.combatParticipant.findFirst({
          where: {
            characterId,
            encounter: { campaignId: { not: campaignId } },
          },
        }))
      )
        throw new ConflictException(
          'Esta ficha já participa de outra campanha. Use uma cópia explícita.',
        );
      const entity = await tx.campaignEntity.create({
        data: {
          campaignId,
          key: `character-${characterId}`,
          kind: 'CHARACTER',
          name: character.name,
        },
      });
      await tx.campaignCharacter.create({
        data: { campaignId, entityId: entity.id, characterId },
      });
      await tx.sceneState.update({
        where: { campaignId },
        data: { revision: { increment: 1 } },
      });
      await tx.campaignLore.update({
        where: { campaignId },
        data: { revision: { increment: 1 } },
      });
      return { entityId: entity.id, characterId };
    });
  }
}
