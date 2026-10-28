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
  durationRounds?: number;
  source?: string;
}

export interface HudItem {
  inventoryItemId: string;
  itemId: string;
  name: string;
  quantity: number;
  category: string;
  properties: string | null;
  description: string | null;
  effectKind: "HEAL" | "TEMP_HP" | "DAMAGE" | null;
}

export interface HudSpell {
  characterSpellId: string;
  spellId: string;
  name: string;
  level: number;
  school: string;
  concentration: boolean;
  description: string | null;
  effectKind: "HEAL" | "DAMAGE" | "MARK" | "BUFF";
  saveAbility: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA" | null;
  halfOnSuccess: boolean;
  attack: boolean;
  targetMode: "SINGLE" | "MULTIPLE";
  formula: string;
  upcastFormula: string | null;
  actionType: "ACTION" | "BONUS";
}

export interface HudSpellSlot {
  level: number;
  total: number;
  used: number;
}

export interface HudConcentration {
  spellId: string;
  spellName: string;
  targets: Array<{
    kind: "CHARACTER" | "PARTICIPANT";
    id: string;
    name: string;
  }>;
  targetName?: string;
  condition: string;
  bonusFormula: string;
  startedAt: string;
  expiresAt: string;
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
  conditionTimers: Array<{
    name: string;
    remainingRounds: number;
    source: string | null;
  }>;
  concentration: HudConcentration | null;
  items: HudItem[];
  spells: HudSpell[];
  spellSlots: HudSpellSlot[];
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
  durationRounds: number | null;
  remainingRounds: number | null;
  source: string | null;
  alreadyApplied: boolean;
  createdAt: string;
}

export interface ItemUseResult {
  actionId: string;
  requestKey: string;
  kind: "USE_ITEM";
  effectKind: "HEAL" | "TEMP_HP" | "DAMAGE";
  target: {
    kind: "CHARACTER";
    id: string;
    name: string;
    characterId: string;
  };
  amount: number;
  breakdown: DiceRollBreakdown | null;
  damageType: string;
  hpBefore: { current: number; max: number; temp: number };
  hpAfter: { current: number; max: number; temp: number };
  applied: number;
  absorbedByTempHp: number;
  item: {
    inventoryItemId: string;
    itemId: string;
    name: string;
    quantityBefore: number;
    quantityAfter: number;
  };
  source: string;
  alreadyApplied: boolean;
  createdAt: string;
}

export interface SpellCastResult {
  actionId: string;
  requestKey: string;
  kind: "CAST_SPELL";
  spell: {
    characterSpellId: string;
    spellId: string;
    name: string;
    level: number;
    school: string;
    castLevel: number;
  };
  slot: { level: number; usedBefore: number; usedAfter: number } | null;
  actionType: "ACTION" | "BONUS";
  targets: Array<{
    kind: "CHARACTER" | "PARTICIPANT";
    id: string;
    name: string;
    characterId: string | null;
    hpBefore: { current: number; max: number; temp: number } | null;
    hpAfter: { current: number; max: number; temp: number } | null;
    save: {
      ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
      roll: number;
      modifier: number;
      total: number;
      dc: number;
      success: boolean;
      blessFormula: string | null;
      blessAmount: number;
    } | null;
    attack: {
      roll: number;
      modifier: number;
      total: number;
      ac: number;
      hit: boolean;
      critical: boolean;
      blessFormula: string | null;
      blessAmount: number;
    } | null;
    amount: number;
    applied: number;
    absorbedByTempHp: number;
  }>;
  damageType: string | null;
  effectKind: "HEAL" | "DAMAGE" | "MARK" | "BUFF";
  mark: {
    condition: string;
    bonusFormula: string;
    durationMinutes: number;
    expiresAt: string;
  } | null;
  source: string;
  alreadyApplied: boolean;
  createdAt: string;
}

export interface WeaponAttackResult {
  actionId: string;
  requestKey: string;
  kind: "WEAPON_ATTACK";
  weapon: {
    inventoryItemId: string;
    itemId: string;
    name: string;
  };
  target: {
    kind: "CHARACTER" | "PARTICIPANT";
    id: string;
    name: string;
    characterId: string | null;
  };
  attack: {
    roll: number;
    modifier: number;
    total: number;
    ac: number;
    hit: boolean;
    critical: boolean;
    blessFormula: string | null;
    blessAmount: number;
  };
  damage: {
    formula: string | null;
    fixed: number | null;
    modifier: number;
    amount: number;
    damageType: string;
    critical: boolean;
    markFormula: string | null;
    markAmount: number;
  };
  hpBefore: { current: number; max: number; temp: number } | null;
  hpAfter: { current: number; max: number; temp: number } | null;
  applied: number;
  absorbedByTempHp: number;
  source: string;
  alreadyApplied: boolean;
  createdAt: string;
}

export interface DeathSaveResult {
  actionId: string;
  requestKey: string;
  kind: "DEATH_SAVE";
  target: {
    kind: "PARTICIPANT";
    id: string;
    name: string;
    characterId: string;
  };
  roll: number;
  successes: number;
  failures: number;
  stable: boolean;
  dead: boolean;
  revived: boolean;
  outcome: "REVIVED" | "STABLE" | "DEAD" | "PENDING";
  hpBefore: { current: number; max: number; temp: number };
  hpAfter: { current: number; max: number; temp: number };
  alreadyApplied: boolean;
  createdAt: string;
}

export type TableActionResult =
  | CombatActionResult
  | ItemUseResult
  | SpellCastResult
  | WeaponAttackResult
  | DeathSaveResult;

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
