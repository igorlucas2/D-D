import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseJson } from '../common/json';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVttMapDto } from './dto/create-vtt-map.dto';
import { UpdateVttMapDto } from './dto/update-vtt-map.dto';
import { CreateVttTokenDto } from './dto/create-vtt-token.dto';
import { UpdateVttTokenDto } from './dto/update-vtt-token.dto';
import { CreateVttMarkerDto } from './dto/create-vtt-marker.dto';
import { UpdateVttMarkerDto } from './dto/update-vtt-marker.dto';
import { CreateVttMapHotspotDto } from './dto/create-vtt-map-hotspot.dto';
import { UpdateVttMapHotspotDto } from './dto/update-vtt-map-hotspot.dto';
import { VttGateway } from './vtt.gateway';
import type { SerializedVttMap } from './vtt.types';
import { projectPlayerMap } from './vtt.projection';
import { sanitizeWalls, wallKey } from './vision';
import { canReach, canReachDoor } from './movement';
import { MoveVttTokenDto, ToggleVttDoorDto } from './dto/player-action.dto';

const MAP_INCLUDE = {
  tokens: {
    orderBy: { id: 'asc' },
    include: { character: { select: { userId: true } } },
  },
  markers: { orderBy: { id: 'asc' } },
  hotspots: { orderBy: { id: 'asc' } },
} satisfies Prisma.VttMapInclude;

type VttMapWithTokens = Prisma.VttMapGetPayload<{
  include: typeof MAP_INCLUDE;
}>;

@Injectable()
export class VttService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly vttGateway: VttGateway,
  ) {}

  async findMaps(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    const isMaster = campaign.masterId === userId;

    const maps = await this.prisma.vttMap.findMany({
      where: { campaignId, ...(isMaster ? {} : { published: true }) },
      include: MAP_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    const publishedIds = new Set(
      maps.filter((map) => map.published).map((map) => map.id),
    );
    return maps.map((map) =>
      isMaster
        ? this.serializeMap(map)
        : projectPlayerMap(
            this.serializeMap(map),
            publishedIds,
            campaign.masterId,
          ),
    );
  }

  async findMap(campaignId: string, mapId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    if (campaign.masterId === userId) return this.serializeMap(map);
    if (!map.published) throw new NotFoundException('Mapa não encontrado.');
    const published = await this.prisma.vttMap.findMany({
      where: { campaignId, published: true },
      select: { id: true },
    });
    return projectPlayerMap(
      this.serializeMap(map),
      new Set(published.map((item) => item.id)),
      campaign.masterId,
    );
  }

  async createMap(campaignId: string, userId: string, dto: CreateVttMapDto) {
    await this.assertIsMaster(campaignId, userId);

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Informe um nome para o mapa.');
    }

    if (dto.parentMapId) {
      await this.getOwnedMap(campaignId, dto.parentMapId);
    }

    const width = dto.width ?? 24;
    const height = dto.height ?? 16;
    const map = await this.prisma.vttMap.create({
      data: {
        campaignId,
        parentMapId: dto.parentMapId || null,
        kind: dto.kind ?? 'OTHER',
        name,
        width,
        height,
        gridSize: dto.gridSize ?? 1,
        gridColor: dto.gridColor ?? '#94a3b8',
        imageUrl: dto.imageUrl?.trim() || null,
        fogOfWarData: this.stringifyFogCells(dto.fogCells, width, height),
      },
      include: MAP_INCLUDE,
    });

    const serialized = this.serializeMap(map);
    await this.vttGateway.emitMapCreated(campaignId, serialized);
    return serialized;
  }

  async updateMap(
    campaignId: string,
    mapId: string,
    userId: string,
    dto: UpdateVttMapDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const existing = await this.getOwnedMap(campaignId, mapId);

    if (
      dto.expectedRevision !== undefined &&
      dto.expectedRevision !== existing.revision
    ) {
      throw new ConflictException(
        'O mapa foi alterado por outra pessoa. Recarregue antes de salvar.',
      );
    }

    const width = dto.width ?? existing.width;
    const height = dto.height ?? existing.height;
    const data: Prisma.VttMapUpdateInput = {};
    if (dto.published !== undefined) data.published = dto.published;

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Informe um nome para o mapa.');
      }
      data.name = name;
    }
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.lightingMode !== undefined) data.lightingMode = dto.lightingMode;
    if (dto.vision !== undefined) data.vision = dto.vision;
    if (dto.walls !== undefined) {
      const walls = sanitizeWalls(
        dto.walls,
        dto.width ?? existing.width,
        dto.height ?? existing.height,
      );
      data.wallsData = walls.length ? JSON.stringify(walls) : null;
    }
    if (dto.ambiencePreset !== undefined)
      data.ambiencePreset = dto.ambiencePreset;
    if (dto.parentMapId !== undefined) {
      if (dto.parentMapId === null || dto.parentMapId === '') {
        data.parentMap = { disconnect: true };
      } else {
        if (dto.parentMapId === mapId) {
          throw new BadRequestException('Um mapa nao pode ser pai dele mesmo.');
        }
        await this.getOwnedMap(campaignId, dto.parentMapId);
        await this.assertNotDescendant(mapId, dto.parentMapId);
        data.parentMap = { connect: { id: dto.parentMapId } };
      }
    }
    if (dto.width !== undefined) data.width = dto.width;
    if (dto.height !== undefined) data.height = dto.height;
    if (dto.gridSize !== undefined) data.gridSize = dto.gridSize;
    if (dto.gridColor !== undefined) data.gridColor = dto.gridColor;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl.trim() || null;
    if (dto.fogCells !== undefined) {
      data.fogOfWarData = this.stringifyFogCells(dto.fogCells, width, height);
    } else if (dto.width !== undefined || dto.height !== undefined) {
      data.fogOfWarData = this.stringifyFogCells(
        this.parseFogCells(existing.fogOfWarData),
        width,
        height,
      );
    }

    if (dto.expectedRevision === undefined) {
      await this.prisma.vttMap.update({
        where: { id: mapId },
        data: { ...data, revision: { increment: 1 } },
      });
    } else {
      // Concorrência otimista (P1-2): só grava se a revisão ainda for a que o
      // cliente leu. O CAS e a gravação ficam na mesma transação.
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.vttMap.updateMany({
          where: {
            id: mapId,
            campaignId,
            revision: dto.expectedRevision,
          },
          data: { revision: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw new ConflictException(
            'O mapa foi alterado por outra pessoa. Recarregue antes de salvar.',
          );
        }
        await tx.vttMap.update({ where: { id: mapId }, data });
      });
    }

    if (dto.width !== undefined || dto.height !== undefined) {
      await this.clampTokensToMap(mapId, width, height);
    }

    const updated = await this.findMap(campaignId, mapId, userId);
    if (dto.published !== undefined && dto.published !== existing.published) {
      await this.resyncPlayers(campaignId);
    }
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async removeMap(campaignId: string, mapId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    if (
      await this.prisma.campaignLoreMap.findUnique({
        where: { campaignId_mapId: { campaignId, mapId } },
      })
    )
      throw new ConflictException(
        'Este mapa pertence ao mundo persistente e não pode ser removido isoladamente.',
      );
    await this.getOwnedMap(campaignId, mapId);
    await this.prisma.vttMap.delete({ where: { id: mapId } });
    this.vttGateway.emitMapRemoved(campaignId, mapId);
    return { success: true };
  }

  async createToken(
    campaignId: string,
    mapId: string,
    userId: string,
    dto: CreateVttTokenDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Informe um nome para o token.');
    }
    if (dto.characterId) {
      await this.assertCharacterExists(dto.characterId, campaignId);
    }

    const size = dto.size ?? 1;
    const position = this.clampTokenPosition(
      dto.x ?? 0,
      dto.y ?? 0,
      size,
      map.width,
      map.height,
    );

    await this.prisma.vttToken.create({
      data: {
        mapId,
        characterId: dto.characterId,
        name,
        x: position.x,
        y: position.y,
        size,
        color: dto.color?.trim() || '#f59e0b',
        imageUrl: dto.imageUrl?.trim() || null,
        visible: dto.visible ?? true,
        lightRadius: dto.lightRadius ?? 0,
        visionRadius: dto.visionRadius ?? 0,
      },
    });

    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async updateToken(
    campaignId: string,
    mapId: string,
    tokenId: string,
    userId: string,
    dto: UpdateVttTokenDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    const token = await this.getOwnedToken(mapId, tokenId);
    const nextSize = dto.size ?? token.size;
    const nextX = dto.x ?? token.x;
    const nextY = dto.y ?? token.y;
    const position = this.clampTokenPosition(
      nextX,
      nextY,
      nextSize,
      map.width,
      map.height,
    );

    const data: Prisma.VttTokenUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Informe um nome para o token.');
      }
      data.name = name;
    }
    if (dto.characterId !== undefined) {
      if (dto.characterId) {
        await this.assertCharacterExists(dto.characterId, campaignId);
        data.character = { connect: { id: dto.characterId } };
      } else {
        data.character = { disconnect: true };
      }
    }
    if (dto.x !== undefined || dto.y !== undefined || dto.size !== undefined) {
      data.x = position.x;
      data.y = position.y;
      data.size = nextSize;
    }
    if (dto.color !== undefined) data.color = dto.color.trim() || token.color;
    if (dto.imageUrl !== undefined)
      data.imageUrl = dto.imageUrl?.trim() || null;
    if (dto.visible !== undefined) data.visible = dto.visible;
    if (dto.lightRadius !== undefined) data.lightRadius = dto.lightRadius;
    if (dto.visionRadius !== undefined) data.visionRadius = dto.visionRadius;

    await this.prisma.vttToken.update({ where: { id: tokenId }, data });

    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  /**
   * Jogador move o próprio token (MV-07). O mestre continua usando
   * updateToken; aqui valem as regras da mesa: só o token do personagem dele,
   * visível, num mapa publicado, sem atravessar parede ou porta fechada e,
   * em combate, só no próprio turno.
   */
  async moveToken(
    campaignId: string,
    mapId: string,
    tokenId: string,
    userId: string,
    dto: MoveVttTokenDto,
  ) {
    const campaign = await this.assertIsMember(campaignId, userId);
    if (campaign.masterId === userId) {
      return this.updateToken(campaignId, mapId, tokenId, userId, dto);
    }
    const map = await this.getOwnedMap(campaignId, mapId);
    const token = map.tokens.find((item) => item.id === tokenId);
    if (!map.published || !token || !token.visible) {
      throw new NotFoundException('Token nao encontrado.');
    }
    if (token.character?.userId !== userId) {
      throw new ForbiddenException('Voce so pode mover o seu personagem.');
    }
    await this.assertPlayerTurn(campaignId, token.characterId);

    const position = this.clampTokenPosition(
      dto.x,
      dto.y,
      token.size,
      map.width,
      map.height,
    );
    const walls = this.parseWalls(map.wallsData, map.width, map.height);
    if (
      !canReach(token, position.x, position.y, map.width, map.height, walls)
    ) {
      throw new BadRequestException(
        'Uma parede ou porta fechada impede o caminho.',
      );
    }
    if (position.x !== token.x || position.y !== token.y) {
      await this.prisma.vttToken.update({
        where: { id: tokenId },
        data: position,
      });
      await this.vttGateway.emitMapUpdated(
        campaignId,
        this.serializeMap(await this.getOwnedMap(campaignId, mapId)),
      );
    }
    return this.findMap(campaignId, mapId, userId);
  }

  /** Abre ou fecha uma porta. Jogador só alcança portas junto de um token seu. */
  async toggleDoor(
    campaignId: string,
    mapId: string,
    userId: string,
    dto: ToggleVttDoorDto,
  ) {
    const campaign = await this.assertIsMember(campaignId, userId);
    const isMaster = campaign.masterId === userId;
    const map = await this.getOwnedMap(campaignId, mapId);
    if (!isMaster && !map.published) {
      throw new NotFoundException('Mapa não encontrado.');
    }
    const walls = this.parseWalls(map.wallsData, map.width, map.height);
    const key = wallKey({
      x1: Math.min(dto.x1, dto.x2),
      y1: Math.min(dto.y1, dto.y2),
      x2: Math.max(dto.x1, dto.x2),
      y2: Math.max(dto.y1, dto.y2),
    });
    const door = walls.find((wall) => wall.door && wallKey(wall) === key);
    if (!door) throw new NotFoundException('Porta nao encontrada.');
    if (!isMaster) {
      const near = map.tokens.some(
        (token) =>
          token.visible &&
          token.character?.userId === userId &&
          canReachDoor(token, door),
      );
      if (!near) {
        throw new ForbiddenException(
          'Aproxime o seu personagem da porta para abri-la.',
        );
      }
    }
    door.door = door.door === 'open' ? 'closed' : 'open';
    await this.prisma.vttMap.update({
      where: { id: mapId },
      data: { wallsData: JSON.stringify(walls) },
    });
    await this.vttGateway.emitMapUpdated(
      campaignId,
      this.serializeMap(await this.getOwnedMap(campaignId, mapId)),
    );
    return this.findMap(campaignId, mapId, userId);
  }

  /** Em combate, o personagem que está no combate só anda no próprio turno. */
  private async assertPlayerTurn(
    campaignId: string,
    characterId: string | null,
  ) {
    if (!characterId) return;
    const encounter = await this.prisma.combatEncounter.findUnique({
      where: { campaignId },
      include: {
        participants: {
          orderBy: [{ initiative: 'desc' }, { id: 'asc' }],
          select: { characterId: true },
        },
      },
    });
    if (!encounter) return;
    const inCombat = encounter.participants.some(
      (item) => item.characterId === characterId,
    );
    if (!inCombat) return;
    const current = encounter.participants[encounter.turnIndex];
    if (current?.characterId !== characterId) {
      throw new ForbiddenException(
        'Em combate, mova o personagem no seu turno.',
      );
    }
  }

  async removeToken(
    campaignId: string,
    mapId: string,
    tokenId: string,
    userId: string,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedMap(campaignId, mapId);
    await this.getOwnedToken(mapId, tokenId);
    await this.prisma.vttToken.delete({ where: { id: tokenId } });
    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async createMarker(
    campaignId: string,
    mapId: string,
    userId: string,
    dto: CreateVttMarkerDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    const label = dto.label.trim();

    if (!label) {
      throw new BadRequestException('Informe um nome para o marcador.');
    }

    const position = this.clampTokenPosition(
      dto.x,
      dto.y,
      1,
      map.width,
      map.height,
    );

    await this.prisma.vttMarker.create({
      data: {
        mapId,
        x: position.x,
        y: position.y,
        label,
        color: dto.color?.trim() || '#38bdf8',
        note: dto.note?.trim() || null,
      },
    });

    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async updateMarker(
    campaignId: string,
    mapId: string,
    markerId: string,
    userId: string,
    dto: UpdateVttMarkerDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    const marker = await this.getOwnedMarker(mapId, markerId);

    const data: Prisma.VttMarkerUpdateInput = {};
    if (dto.label !== undefined) {
      const label = dto.label.trim();
      if (!label) {
        throw new BadRequestException('Informe um nome para o marcador.');
      }
      data.label = label;
    }
    if (dto.x !== undefined || dto.y !== undefined) {
      const position = this.clampTokenPosition(
        dto.x ?? marker.x,
        dto.y ?? marker.y,
        1,
        map.width,
        map.height,
      );
      data.x = position.x;
      data.y = position.y;
    }
    if (dto.color !== undefined) data.color = dto.color.trim() || marker.color;
    if (dto.note !== undefined) data.note = dto.note?.trim() || null;

    await this.prisma.vttMarker.update({ where: { id: markerId }, data });

    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async removeMarker(
    campaignId: string,
    mapId: string,
    markerId: string,
    userId: string,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedMap(campaignId, mapId);
    await this.getOwnedMarker(mapId, markerId);
    await this.prisma.vttMarker.delete({ where: { id: markerId } });
    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async createHotspot(
    campaignId: string,
    mapId: string,
    userId: string,
    dto: CreateVttMapHotspotDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    const label = dto.label.trim();

    if (!label) {
      throw new BadRequestException('Informe um nome para o local.');
    }

    const rect = this.clampHotspotRect(
      dto.x,
      dto.y,
      dto.width ?? 1,
      dto.height ?? 1,
      map.width,
      map.height,
    );

    let targetMapId: string | null = null;
    if (dto.targetMapId) {
      targetMapId = await this.resolveHotspotTarget(
        campaignId,
        dto.targetMapId,
      );
    }

    await this.prisma.vttMapHotspot.create({
      data: {
        mapId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        label,
        icon: dto.icon?.trim() || 'map-pin',
        color: dto.color?.trim() || '#38bdf8',
        targetMapId,
        visibleToPlayers: dto.visibleToPlayers ?? true,
        travelActionCost: dto.travelActionCost ?? 1,
        travelMinutes: dto.travelMinutes ?? 30,
        eventNote: dto.eventNote?.trim() || null,
        triggerJournalCategory: dto.triggerJournalCategory ?? null,
      },
    });

    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async updateHotspot(
    campaignId: string,
    mapId: string,
    hotspotId: string,
    userId: string,
    dto: UpdateVttMapHotspotDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    const hotspot = await this.getOwnedHotspot(mapId, hotspotId);

    const data: Prisma.VttMapHotspotUpdateInput = {};

    if (dto.label !== undefined) {
      const label = dto.label.trim();
      if (!label) {
        throw new BadRequestException('Informe um nome para o local.');
      }
      data.label = label;
    }
    if (dto.icon !== undefined) data.icon = dto.icon.trim() || hotspot.icon;
    if (dto.color !== undefined) data.color = dto.color.trim() || hotspot.color;
    if (dto.visibleToPlayers !== undefined)
      data.visibleToPlayers = dto.visibleToPlayers;
    if (dto.travelActionCost !== undefined)
      data.travelActionCost = dto.travelActionCost;
    if (dto.travelMinutes !== undefined) data.travelMinutes = dto.travelMinutes;
    if (dto.eventNote !== undefined)
      data.eventNote = dto.eventNote?.trim() || null;
    if (dto.triggerJournalCategory !== undefined)
      data.triggerJournalCategory = dto.triggerJournalCategory;

    if (
      dto.x !== undefined ||
      dto.y !== undefined ||
      dto.width !== undefined ||
      dto.height !== undefined
    ) {
      const rect = this.clampHotspotRect(
        dto.x ?? hotspot.x,
        dto.y ?? hotspot.y,
        dto.width ?? hotspot.width,
        dto.height ?? hotspot.height,
        map.width,
        map.height,
      );
      data.x = rect.x;
      data.y = rect.y;
      data.width = rect.width;
      data.height = rect.height;
    }

    if (dto.targetMapId !== undefined) {
      if (!dto.targetMapId) {
        data.targetMap = { disconnect: true };
      } else {
        const targetMapId = await this.resolveHotspotTarget(
          campaignId,
          dto.targetMapId,
          hotspotId,
        );
        data.targetMap = { connect: { id: targetMapId } };
      }
    }

    await this.prisma.vttMapHotspot.update({ where: { id: hotspotId }, data });

    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  async removeHotspot(
    campaignId: string,
    mapId: string,
    hotspotId: string,
    userId: string,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedMap(campaignId, mapId);
    await this.getOwnedHotspot(mapId, hotspotId);
    await this.prisma.vttMapHotspot.delete({ where: { id: hotspotId } });
    const updated = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updated);
    return updated;
  }

  // Atalho: cria um novo mapa filho ja vinculado a este hotspot.
  async createHotspotTarget(
    campaignId: string,
    mapId: string,
    hotspotId: string,
    userId: string,
    dto: CreateVttMapDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedMap(campaignId, mapId);
    const hotspot = await this.getOwnedHotspot(mapId, hotspotId);

    if (hotspot.targetMapId) {
      throw new BadRequestException('Este local ja possui um mapa vinculado.');
    }

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Informe um nome para o mapa.');
    }

    const width = dto.width ?? 24;
    const height = dto.height ?? 16;
    const childMap = await this.prisma.vttMap.create({
      data: {
        campaignId,
        parentMapId: mapId,
        kind: dto.kind ?? 'OTHER',
        name,
        width,
        height,
        gridSize: dto.gridSize ?? 1,
        gridColor: dto.gridColor ?? '#94a3b8',
        imageUrl: dto.imageUrl?.trim() || null,
        fogOfWarData: this.stringifyFogCells(dto.fogCells, width, height),
      },
      include: MAP_INCLUDE,
    });

    await this.prisma.vttMapHotspot.update({
      where: { id: hotspotId },
      data: { targetMap: { connect: { id: childMap.id } } },
    });

    const serializedChild = this.serializeMap(childMap);
    await this.vttGateway.emitMapCreated(campaignId, serializedChild);

    const updatedParent = await this.findMap(campaignId, mapId, userId);
    await this.vttGateway.emitMapUpdated(campaignId, updatedParent);

    return serializedChild;
  }

  private async resyncPlayers(campaignId: string) {
    const [campaign, maps] = await Promise.all([
      this.prisma.campaign.findUniqueOrThrow({
        where: { id: campaignId },
        select: { masterId: true },
      }),
      this.prisma.vttMap.findMany({
        where: { campaignId },
        include: MAP_INCLUDE,
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    this.vttGateway.resyncPlayers(
      campaignId,
      campaign.masterId,
      maps.map((map) => this.serializeMap(map)),
    );
  }

  private async getOwnedMap(campaignId: string, mapId: string) {
    const map = await this.prisma.vttMap.findUnique({
      where: { id: mapId },
      include: MAP_INCLUDE,
    });

    if (!map || map.campaignId !== campaignId) {
      throw new NotFoundException('Mapa nao encontrado.');
    }

    return map;
  }

  private async getOwnedToken(mapId: string, tokenId: string) {
    const token = await this.prisma.vttToken.findUnique({
      where: { id: tokenId },
    });

    if (!token || token.mapId !== mapId) {
      throw new NotFoundException('Token nao encontrado.');
    }

    return token;
  }

  private async getOwnedMarker(mapId: string, markerId: string) {
    const marker = await this.prisma.vttMarker.findUnique({
      where: { id: markerId },
    });

    if (!marker || marker.mapId !== mapId) {
      throw new NotFoundException('Marcador nao encontrado.');
    }

    return marker;
  }

  private async getOwnedHotspot(mapId: string, hotspotId: string) {
    const hotspot = await this.prisma.vttMapHotspot.findUnique({
      where: { id: hotspotId },
    });

    if (!hotspot || hotspot.mapId !== mapId) {
      throw new NotFoundException('Local nao encontrado.');
    }

    return hotspot;
  }

  private clampHotspotRect(
    x: number,
    y: number,
    width: number,
    height: number,
    mapWidth: number,
    mapHeight: number,
  ) {
    const clampedWidth = Math.max(1, Math.min(width, mapWidth));
    const clampedHeight = Math.max(1, Math.min(height, mapHeight));
    return {
      x: Math.max(0, Math.min(x, mapWidth - clampedWidth)),
      y: Math.max(0, Math.min(y, mapHeight - clampedHeight)),
      width: clampedWidth,
      height: clampedHeight,
    };
  }

  // Garante que o mapa de destino existe na campanha e ainda nao esta
  // vinculado a outro hotspot (relacao 1:1 via targetMapId @unique).
  private async resolveHotspotTarget(
    campaignId: string,
    targetMapId: string,
    currentHotspotId?: string,
  ) {
    const targetMap = await this.getOwnedMap(campaignId, targetMapId);

    const existingLink = await this.prisma.vttMapHotspot.findUnique({
      where: { targetMapId },
    });
    if (existingLink && existingLink.id !== currentHotspotId) {
      throw new BadRequestException(
        'Este mapa ja esta vinculado a outro local.',
      );
    }

    return targetMap.id;
  }

  // Impede ciclos na hierarquia: `mapId` nao pode ter `candidateParentId`
  // entre seus descendentes.
  private async assertNotDescendant(mapId: string, candidateParentId: string) {
    let currentId: string | null = candidateParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === mapId) {
        throw new BadRequestException(
          'Nao e possivel mover um mapa para dentro de um de seus proprios mapas filhos.',
        );
      }
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const parent: { parentMapId: string | null } | null =
        await this.prisma.vttMap.findUnique({
          where: { id: currentId },
          select: { parentMapId: true },
        });
      currentId = parent?.parentMapId ?? null;
    }
  }

  private async assertCharacterExists(characterId: string, campaignId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!character) {
      throw new NotFoundException('Personagem nao encontrado.');
    }
    const binding = await this.prisma.campaignCharacter.findUnique({
      where: { characterId },
    });
    if (binding && binding.campaignId !== campaignId)
      throw new ConflictException(
        'Esta ficha está vinculada a outra campanha.',
      );
  }

  private serializeMap(map: VttMapWithTokens): SerializedVttMap {
    const { fogOfWarData, wallsData, tokens, ...rest } = map;
    return {
      ...rest,
      fogCells: this.parseFogCells(fogOfWarData),
      walls: this.parseWalls(wallsData, map.width, map.height),
      tokens: tokens.map(({ character, ...token }) => ({
        ...token,
        ownerId: character?.userId ?? null,
      })),
    };
  }

  private parseWalls(value: string | null, width: number, height: number) {
    if (!value) return [];
    return sanitizeWalls(parseJson(value), width, height);
  }

  /** Mestre: o mapa exatamente como os jogadores o recebem agora. */
  async playerView(campaignId: string, mapId: string, userId: string) {
    const campaign = await this.assertIsMaster(campaignId, userId);
    const map = await this.getOwnedMap(campaignId, mapId);
    const published = await this.prisma.vttMap.findMany({
      where: { campaignId, published: true },
      select: { id: true },
    });
    const ids = new Set(published.map((item) => item.id));
    ids.add(mapId);
    return projectPlayerMap(this.serializeMap(map), ids, campaign.masterId);
  }

  private stringifyFogCells(
    cells: string[] | undefined,
    width: number,
    height: number,
  ) {
    const fogCells = this.sanitizeFogCells(cells ?? [], width, height);
    return fogCells.length ? JSON.stringify(fogCells) : null;
  }

  private parseFogCells(value: string | null) {
    if (!value) return [];
    const parsed = parseJson(value);
    return Array.isArray(parsed)
      ? parsed.filter((cell): cell is string => typeof cell === 'string')
      : [];
  }

  private sanitizeFogCells(cells: string[], width: number, height: number) {
    const result = new Set<string>();

    for (const cell of cells) {
      const [xValue, yValue] = cell.split(':');
      const x = Number(xValue);
      const y = Number(yValue);
      if (
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        x >= 0 &&
        y >= 0 &&
        x < width &&
        y < height
      ) {
        result.add(`${x}:${y}`);
      }
    }

    return [...result];
  }

  private clampTokenPosition(
    x: number,
    y: number,
    size: number,
    width: number,
    height: number,
  ) {
    return {
      x: Math.max(0, Math.min(x, Math.max(0, width - size))),
      y: Math.max(0, Math.min(y, Math.max(0, height - size))),
    };
  }

  private async clampTokensToMap(mapId: string, width: number, height: number) {
    const tokens = await this.prisma.vttToken.findMany({ where: { mapId } });

    const updates = tokens.flatMap((token) => {
      const position = this.clampTokenPosition(
        token.x,
        token.y,
        token.size,
        width,
        height,
      );
      if (position.x === token.x && position.y === token.y) {
        return [];
      }
      return [
        this.prisma.vttToken.update({
          where: { id: token.id },
          data: position,
        }),
      ];
    });

    await Promise.all(updates);
  }

  private async assertIsMember(campaignId: string, userId: string) {
    return this.access.member(campaignId, userId);
  }

  private async assertIsMaster(campaignId: string, userId: string) {
    return this.access.master(campaignId, userId);
  }
}
