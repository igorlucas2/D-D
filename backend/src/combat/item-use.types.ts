import { parseJson } from '../common/json';
import {
  DAMAGE_TYPES,
  type DamageType,
  type HpSnapshot,
} from './combat-action.types';

export type ItemEffectKind = 'HEAL' | 'TEMP_HP' | 'DAMAGE';

export interface ItemEffect {
  kind: ItemEffectKind;
  formula: string | null;
  amount: number | null;
  damageType: DamageType;
}

const FORMULA = /^\d{1,2}d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i;

function numberOrFormula(value: unknown): {
  formula: string | null;
  amount: number | null;
} | null {
  if (typeof value === 'string' && FORMULA.test(value.trim())) {
    return { formula: value.trim().toLowerCase(), amount: null };
  }
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 999
  ) {
    return { formula: null, amount: value };
  }
  return null;
}

/**
 * Efeitos de consumíveis vêm do campo `properties` do catálogo:
 * `{"healing":"2d4+2"}`, `{"temporaryHp":5}` ou `{"damage":"1d6","damageType":"fire"}`.
 * O cliente nunca calcula; o servidor valida e rola.
 */
export function parseItemEffect(properties: string | null): ItemEffect | null {
  const data = parseJson(properties);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;

  const candidates: Array<[ItemEffectKind, unknown]> = [
    ['HEAL', record.healing],
    ['TEMP_HP', record.temporaryHp ?? record.tempHp],
    ['DAMAGE', record.damage ?? record.damageFormula],
  ];
  for (const [kind, raw] of candidates) {
    const parsed = numberOrFormula(raw);
    if (!parsed) continue;
    const type =
      typeof record.damageType === 'string' &&
      (DAMAGE_TYPES as readonly string[]).includes(record.damageType)
        ? (record.damageType as DamageType)
        : 'untyped';
    return { kind, ...parsed, damageType: type };
  }
  return null;
}

export interface HudItem {
  inventoryItemId: string;
  itemId: string;
  name: string;
  quantity: number;
  category: string;
  properties: string | null;
  description: string | null;
  effectKind: ItemEffectKind | null;
}

export interface ItemUseResult {
  actionId: string;
  requestKey: string;
  kind: 'USE_ITEM';
  effectKind: ItemEffectKind;
  target: {
    kind: 'CHARACTER';
    id: string;
    name: string;
    characterId: string;
  };
  amount: number;
  breakdown: {
    diceCount: number;
    diceSides: number;
    rolls: number[];
    modifier: number;
    total: number;
  } | null;
  damageType: DamageType;
  hpBefore: HpSnapshot;
  hpAfter: HpSnapshot;
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

export function effectLabel(effect: ItemEffect): string {
  const value = effect.formula ?? String(effect.amount ?? '');
  if (effect.kind === 'HEAL') return `Cura ${value}`;
  if (effect.kind === 'TEMP_HP') return `PV temporário ${value}`;
  return `Dano ${value}`;
}
