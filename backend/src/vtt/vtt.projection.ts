import { computeVisibleCells, visibleWalls } from './vision';
import type { SerializedVttMap } from './vtt.types';

/** The public projection is used by HTTP; sockets carry invalidation only. */
export function projectPlayerMap(
  map: SerializedVttMap,
  publishedIds: Set<string>,
  masterId: string,
): SerializedVttMap {
  // Visão dinâmica (IM-13): o que o grupo não enxerga entra na névoa do
  // jogador, e daí em diante vale a mesma ocultação de tokens e marcadores.
  const fog = new Set(map.fogCells);
  let walls = map.walls;
  if (map.vision !== 'OFF') {
    const viewers = map.tokens.filter(
      (token) => token.ownerId !== null && token.ownerId !== masterId,
    );
    const lights = map.tokens.filter(
      (token) => token.visible && token.lightRadius > 0,
    );
    const seen = computeVisibleCells(
      map.width,
      map.height,
      map.vision,
      map.walls,
      viewers,
      lights,
    );
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!seen.has(`${x}:${y}`)) fog.add(`${x}:${y}`);
      }
    }
    // Paredes longe do que o grupo vê não revelam a planta do lugar.
    walls = visibleWalls(map.walls, seen);
  }
  const overlapsFog = (x: number, y: number, width = 1, height = 1) => {
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        if (fog.has(`${x + dx}:${y + dy}`)) return true;
      }
    }
    return false;
  };

  return {
    id: map.id,
    campaignId: map.campaignId,
    parentMapId:
      map.parentMapId && publishedIds.has(map.parentMapId)
        ? map.parentMapId
        : null,
    kind: map.kind,
    lightingMode: map.lightingMode,
    ambiencePreset: map.ambiencePreset,
    name: map.name,
    width: map.width,
    height: map.height,
    gridSize: map.gridSize,
    gridColor: map.gridColor,
    imageUrl: map.imageUrl,
    published: true,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    revision: map.revision,
    vision: map.vision,
    fogCells: [...fog],
    walls: walls.map((wall) => ({ ...wall })),
    tokens: map.tokens
      .filter(
        (token) =>
          token.visible &&
          !overlapsFog(token.x, token.y, token.size, token.size),
      )
      .map((token) => ({ ...token })),
    markers: map.markers
      .filter((marker) => !overlapsFog(marker.x, marker.y))
      .map((marker) => ({ ...marker, note: null })),
    hotspots: map.hotspots
      .filter(
        (hotspot) =>
          hotspot.visibleToPlayers &&
          !overlapsFog(hotspot.x, hotspot.y, hotspot.width, hotspot.height),
      )
      .map((hotspot) => ({
        ...hotspot,
        targetMapId:
          hotspot.targetMapId && publishedIds.has(hotspot.targetMapId)
            ? hotspot.targetMapId
            : null,
        eventNote: null,
        triggerJournalCategory: null,
        firstVisitedAt: null,
      })),
  };
}
