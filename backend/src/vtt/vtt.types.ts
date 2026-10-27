import type {
  VttMap,
  VttMapHotspot,
  VttMarker,
  VttToken,
} from '@prisma/client';

import type { Wall } from './vision';

/** Token com o dono do personagem (null para NPC/monstro). */
export type SerializedVttToken = VttToken & { ownerId: string | null };

export interface SerializedVttMap extends Omit<
  VttMap,
  'fogOfWarData' | 'wallsData'
> {
  fogCells: string[];
  walls: Wall[];
  tokens: SerializedVttToken[];
  markers: VttMarker[];
  hotspots: VttMapHotspot[];
}

// Paisagens sonoras sintetizadas no cliente (IM-02). Manter em sincronia com
// frontend/src/lib/audio/ambience-presets.ts.
export const AMBIENCE_PRESETS = [
  'tavern',
  'city',
  'forest',
  'road',
  'cave',
  'dungeon',
  'castle',
  'sea',
  'night-wild',
  'silence',
] as const;
