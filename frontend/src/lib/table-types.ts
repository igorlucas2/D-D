import type { DiceRollBreakdown } from "@/lib/types";

export type CombatActionKind = "DAMAGE" | "HEAL" | "TEMP_HP" | "CONDITION";
export type CombatTargetKind = "CHARACTER" | "PARTICIPANT";
export type DamageType =
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder"
  | "untyped";

export interface ActionTarget {
  kind: CombatTargetKind;
  id: string;
  name: string;
  characterId: string | null;
  currentHp?: number | null;
  maxHp?: number | null;
  isAlly?: boolean;
}

export interface MechanicalActionInput {
  kind: CombatActionKind;
  targetKind: CombatTargetKind;
  targetId: string;
  amount?: number;
  formula?: string;
  damageType?: DamageType;
  condition?: string;
  conditionMode?: "ADD" | "REMOVE";
  source?: string;
}

export interface HudCharacter {
  id: string;
  characterId: string;
  name: string;
  isMine: boolean;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;
  conditions: string[];
}

export interface CombatActionResult {
  actionId: string;
  requestKey: string;
  kind: CombatActionKind;
  target: {
    kind: CombatTargetKind;
    id: string;
    name: string;
    characterId: string | null;
  };
  amount: number;
  breakdown: DiceRollBreakdown | null;
  damageType: string | null;
  hpBefore: { current: number; max: number; temp: number } | null;
  hpAfter: { current: number; max: number; temp: number } | null;
  applied: number;
  absorbedByTempHp: number;
  conditionsBefore: string[];
  conditionsAfter: string[];
  source: string | null;
  alreadyApplied: boolean;
  createdAt: string;
}

export const ACTION_LABELS: Record<CombatActionKind, string> = {
  DAMAGE: "Dano",
  HEAL: "Cura",
  TEMP_HP: "PV temporário",
  CONDITION: "Condição",
};

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  acid: "Ácido",
  bludgeoning: "Contundente",
  cold: "Frio",
  fire: "Fogo",
  force: "Força",
  lightning: "Elétrico",
  necrotic: "Necrótico",
  piercing: "Perfurante",
  poison: "Veneno",
  psychic: "Psíquico",
  radiant: "Radiante",
  slashing: "Cortante",
  thunder: "Trovão",
  untyped: "Sem tipo",
};
