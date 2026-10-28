import { parseJson } from '../common/json';
import type { DamageDefense } from './damage-defense.types';
import {
  DAMAGE_TYPES,
  type DamageType,
  type HpSnapshot,
} from './combat-action.types';

export interface WeaponMechanics {
  damageFormula: string | null;
  fixedDamage: number | null;
  damageType: DamageType;
  finesse: boolean;
  ranged: boolean;
  rangeFeet: number;
  twoHanded: boolean;
  versatile: boolean;
  properties: string[];
}

const RANGED_RANGE_FEET: Record<string, number> = {
  shortbow: 80,
  longbow: 150,
  lightcrossbow: 80,
  heavycrossbow: 100,
  handcrossbow: 30,
  sling: 30,
  dart: 20,
  javelin: 30,
  blowgun: 25,
};

export interface WeaponAttackResult {
  actionId: string;
  requestKey: string;
  kind: 'WEAPON_ATTACK';
  weapon: {
    inventoryItemId: string;
    itemId: string;
    name: string;
  };
  target: {
    kind: 'CHARACTER' | 'PARTICIPANT';
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
    damageType: DamageType;
    critical: boolean;
    markFormula: string | null;
    markAmount: number;
    defense: DamageDefense | null;
  };
  hpBefore: HpSnapshot | null;
  hpAfter: HpSnapshot | null;
  applied: number;
  absorbedByTempHp: number;
  source: string;
  alreadyApplied: boolean;
  createdAt: string;
}

const FORMULA = /^\d{1,2}d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function damageTypeFromLabel(value: unknown): DamageType {
  if (typeof value !== 'string') return 'untyped';
  const normalized = normalize(value);
  if (['corte', 'cortante', 'slashing'].includes(normalized)) return 'slashing';
  if (['perfuracao', 'perfurante', 'piercing'].includes(normalized))
    return 'piercing';
  if (['concussao', 'contundente', 'bludgeoning'].includes(normalized))
    return 'bludgeoning';
  return (DAMAGE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as DamageType)
    : 'untyped';
}

export function parseWeaponMechanics(
  properties: string | null,
): WeaponMechanics | null {
  const data = parseJson(properties);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const rawDamage = record.damage;
  let damageFormula: string | null = null;
  let fixedDamage: number | null = null;
  if (typeof rawDamage === 'string') {
    const value = rawDamage.trim().toLowerCase();
    if (FORMULA.test(value)) damageFormula = value;
    else {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 999)
        fixedDamage = parsed;
    }
  } else if (
    typeof rawDamage === 'number' &&
    Number.isInteger(rawDamage) &&
    rawDamage >= 1 &&
    rawDamage <= 999
  ) {
    fixedDamage = rawDamage;
  }
  if (damageFormula === null && fixedDamage === null) return null;
  const rawProperties = Array.isArray(record.properties)
    ? record.properties.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  const normalizedProperties = rawProperties.map(normalize);
  const range =
    typeof record.weaponRange === 'string' ? normalize(record.weaponRange) : '';
  const ranged =
    ['ranged', 'distancia', 'distância'].includes(range) ||
    normalizedProperties.some((item) =>
      ['municao', 'municão', 'ammunition', 'ranged'].includes(item),
    );
  const srdIndex =
    typeof record.srdIndex === 'string' ? normalize(record.srdIndex) : '';
  return {
    damageFormula,
    fixedDamage,
    damageType: damageTypeFromLabel(record.damageType),
    finesse: normalizedProperties.some((item) =>
      ['acuidade', 'finesse'].includes(item),
    ),
    ranged,
    rangeFeet: ranged ? (RANGED_RANGE_FEET[srdIndex] ?? 60) : 5,
    twoHanded: normalizedProperties.some((item) =>
      ['duas maos', 'duas mãos', 'two-handed'].includes(item),
    ),
    versatile: normalizedProperties.some((item) =>
      ['versatil', 'versátil', 'versatile'].includes(item),
    ),
    properties: rawProperties,
  };
}

export function attackAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function weaponAbilityScore(
  character: {
    strength: number;
    dexterity: number;
  },
  mechanics: WeaponMechanics,
): number {
  if (mechanics.ranged) return character.dexterity;
  if (mechanics.finesse)
    return Math.max(character.strength, character.dexterity);
  return character.strength;
}
