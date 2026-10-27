import type { VttLightingMode, VttMapKind } from "@/lib/types";

export type DayPhase = "MADRUGADA" | "ALVORADA" | "DIA" | "CREPUSCULO" | "NOITE";

export interface DayPhaseStyle {
  label: string;
  /** Tom aplicado sobre a imagem do mapa 2D; null = sem camada. */
  overlay: { color: string; opacity: number } | null;
  /** Luz direcional da mesa 3D. `azimuth` em graus: 90 = leste, 270 = oeste. */
  sun: { color: string; intensity: number; elevation: number; azimuth: number };
  ambient: number;
}

export const DAY_PHASE_STYLES: Record<DayPhase, DayPhaseStyle> = {
  MADRUGADA: {
    label: "Madrugada",
    overlay: { color: "#0d1630", opacity: 0.45 },
    sun: { color: "#a3aed0", intensity: 0.6, elevation: 60, azimuth: 180 },
    ambient: 0.5,
  },
  ALVORADA: {
    label: "Alvorada",
    overlay: { color: "#c9785a", opacity: 0.2 },
    sun: { color: "#f2b880", intensity: 0.9, elevation: 15, azimuth: 90 },
    ambient: 0.65,
  },
  DIA: {
    label: "Dia",
    overlay: null,
    sun: { color: "#fff4e0", intensity: 1.2, elevation: 65, azimuth: 160 },
    ambient: 0.8,
  },
  CREPUSCULO: {
    label: "Crepúsculo",
    overlay: { color: "#a8452f", opacity: 0.25 },
    sun: { color: "#e08a5a", intensity: 0.9, elevation: 15, azimuth: 270 },
    ambient: 0.65,
  },
  NOITE: {
    label: "Noite",
    overlay: { color: "#16234a", opacity: 0.35 },
    sun: { color: "#b8c2de", intensity: 0.75, elevation: 55, azimuth: 200 },
    ambient: 0.7,
  },
};

/** Luz interior: estável, quente e independente do céu. */
export const INDOOR_STYLE: DayPhaseStyle = {
  label: "Interior",
  overlay: null,
  sun: { color: "#ffe2b8", intensity: 0.9, elevation: 70, azimuth: 160 },
  ambient: 0.75,
};

export function getDayPhase(hour: number): DayPhase {
  if (hour <= 4) return "MADRUGADA";
  if (hour <= 6) return "ALVORADA";
  if (hour <= 16) return "DIA";
  if (hour <= 18) return "CREPUSCULO";
  return "NOITE";
}

const INDOOR_KINDS: VttMapKind[] = ["BUILDING", "INTERIOR"];

/**
 * Iluminação efetiva de um mapa. Sem relógio carregado, o mapa fica com luz de
 * dia para não escurecer a mesa por falta de dados.
 */
export function resolveMapLighting(
  kind: VttMapKind,
  mode: VttLightingMode | undefined,
  hour: number | null,
): DayPhaseStyle {
  const effectiveMode = mode ?? "AUTO";
  if (effectiveMode === "INDOOR") return INDOOR_STYLE;
  if (effectiveMode === "FIXED_DAY") return DAY_PHASE_STYLES.DIA;
  if (effectiveMode === "FIXED_NIGHT") return DAY_PHASE_STYLES.NOITE;
  if (INDOOR_KINDS.includes(kind)) return INDOOR_STYLE;
  if (hour === null) return DAY_PHASE_STYLES.DIA;
  return DAY_PHASE_STYLES[getDayPhase(hour)];
}
