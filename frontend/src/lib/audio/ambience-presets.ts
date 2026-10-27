import type { VttMapKind } from "@/lib/types";

// Manter em sincronia com AMBIENCE_PRESETS em backend/src/vtt/vtt.types.ts.
export const AMBIENCE_PRESETS = [
  "tavern",
  "city",
  "forest",
  "road",
  "cave",
  "dungeon",
  "castle",
  "sea",
  "night-wild",
  "silence",
] as const;

export type AmbiencePreset = (typeof AMBIENCE_PRESETS)[number];

export const AMBIENCE_PRESET_LABELS: Record<AmbiencePreset, string> = {
  tavern: "Taverna",
  city: "Cidade",
  forest: "Floresta",
  road: "Estrada / campo aberto",
  cave: "Caverna",
  dungeon: "Masmorra",
  castle: "Castelo",
  sea: "Mar",
  "night-wild": "Ermo à noite",
  silence: "Silêncio",
};

const DEFAULT_BY_KIND: Record<VttMapKind, AmbiencePreset> = {
  WORLD: "road",
  REGION: "road",
  SETTLEMENT: "city",
  BUILDING: "silence",
  INTERIOR: "silence",
  OTHER: "silence",
};

/** Ambientes ao ar livre recebem a camada de grilos durante a noite. */
export const OUTDOOR_PRESETS: ReadonlySet<AmbiencePreset> = new Set(["city", "forest", "road"]);

export function resolveAmbience(kind: VttMapKind, preset: AmbiencePreset | null | undefined): AmbiencePreset {
  return preset ?? DEFAULT_BY_KIND[kind];
}
