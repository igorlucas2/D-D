export type CombatActionKind = 'DAMAGE' | 'HEAL' | 'TEMP_HP' | 'CONDITION';
export type CombatTargetKind = 'CHARACTER' | 'PARTICIPANT';

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
  'untyped',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export interface HpSnapshot {
  current: number;
  max: number;
  temp: number;
}

export interface DamageResult {
  hp: HpSnapshot;
  /** PV realmente perdidos. */
  applied: number;
  /** Dano consumido pelos PV temporários. */
  absorbedByTempHp: number;
}

export function applyDamage(hp: HpSnapshot, amount: number): DamageResult {
  const damage = Math.max(0, Math.floor(amount));
  const absorbedByTempHp = Math.min(hp.temp, damage);
  const remaining = damage - absorbedByTempHp;
  const applied = Math.min(hp.current, remaining);
  return {
    hp: {
      current: hp.current - applied,
      max: hp.max,
      temp: hp.temp - absorbedByTempHp,
    },
    applied,
    absorbedByTempHp,
  };
}

export function applyHeal(hp: HpSnapshot, amount: number): HpSnapshot {
  return {
    ...hp,
    current: Math.min(hp.max, hp.current + Math.max(0, Math.floor(amount))),
  };
}

export function applyTempHp(hp: HpSnapshot, amount: number): HpSnapshot {
  return {
    ...hp,
    temp: Math.max(hp.temp, Math.max(0, Math.floor(amount))),
  };
}

const MAX_CONDITIONS = 20;
const MAX_CONDITION_LENGTH = 60;

function normalizeCondition(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function addCondition(
  conditions: readonly string[],
  value: string,
): string[] {
  const condition = normalizeCondition(value);
  if (!condition) throw new RangeError('Condição vazia.');
  if (condition.length > MAX_CONDITION_LENGTH)
    throw new RangeError('Condição longa demais.');
  if (conditions.some((item) => item.toLowerCase() === condition.toLowerCase()))
    return [...conditions];
  if (conditions.length >= MAX_CONDITIONS)
    throw new RangeError('Limite de condições atingido.');
  return [...conditions, condition];
}

export function removeCondition(
  conditions: readonly string[],
  value: string,
): string[] {
  const target = normalizeCondition(value).toLowerCase();
  return conditions.filter((item) => item.toLowerCase() !== target);
}

export interface CombatActionTarget {
  kind: CombatTargetKind;
  id: string;
  name: string;
  characterId: string | null;
}

export interface CombatActionResult {
  actionId: string;
  requestKey: string;
  kind: CombatActionKind;
  target: CombatActionTarget;
  amount: number;
  breakdown: {
    diceCount: number;
    diceSides: number;
    rolls: number[];
    modifier: number;
    total: number;
  } | null;
  damageType: DamageType | null;
  hpBefore: HpSnapshot | null;
  hpAfter: HpSnapshot | null;
  applied: number;
  absorbedByTempHp: number;
  conditionsBefore: string[];
  conditionsAfter: string[];
  source: string | null;
  alreadyApplied: boolean;
  createdAt: string;
}
