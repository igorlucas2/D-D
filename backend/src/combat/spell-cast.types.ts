import { parseJson } from '../common/json';
import {
  DAMAGE_TYPES,
  type DamageType,
  type HpSnapshot,
} from './combat-action.types';

export type SpellEffectKind = 'HEAL' | 'DAMAGE' | 'MARK';
export type SpellTargetMode = 'SINGLE' | 'MULTIPLE';
export type SpellAbility = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface SpellMechanics {
  kind: SpellEffectKind;
  formula: string;
  damageType: DamageType;
  addSpellcastingModifier: boolean;
  save: { ability: SpellAbility; halfOnSuccess: boolean } | null;
  attack: 'SPELL' | null;
  upcast: { formula: string | null } | null;
  targets: SpellTargetMode;
  concentration?: {
    condition: string;
    bonusFormula: string;
    durationMinutes: number;
  } | null;
}

export interface SpellHud {
  characterSpellId: string;
  spellId: string;
  name: string;
  level: number;
  school: string;
  concentration: boolean;
  description: string | null;
  effectKind: SpellEffectKind;
  saveAbility: SpellAbility | null;
  halfOnSuccess: boolean;
  attack: boolean;
  targetMode: SpellTargetMode;
  formula: string;
  upcastFormula: string | null;
}

export interface SpellSlotHud {
  level: number;
  total: number;
  used: number;
}

export interface SpellCastResult {
  actionId: string;
  requestKey: string;
  kind: 'CAST_SPELL';
  spell: {
    characterSpellId: string;
    spellId: string;
    name: string;
    level: number;
    school: string;
    castLevel: number;
  };
  slot: { level: number; usedBefore: number; usedAfter: number } | null;
  targets: Array<{
    kind: 'CHARACTER' | 'PARTICIPANT';
    id: string;
    name: string;
    characterId: string | null;
    hpBefore: HpSnapshot | null;
    hpAfter: HpSnapshot | null;
    save: {
      ability: SpellAbility;
      roll: number;
      modifier: number;
      total: number;
      dc: number;
      success: boolean;
    } | null;
    attack: {
      roll: number;
      modifier: number;
      total: number;
      ac: number;
      hit: boolean;
      critical: boolean;
    } | null;
    amount: number;
    applied: number;
    absorbedByTempHp: number;
  }>;
  damageType: DamageType | null;
  effectKind: SpellEffectKind;
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

const FORMULA = /^\d{1,2}d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i;

const FALLBACKS: Record<string, SpellMechanics> = {
  'curar ferimentos': {
    kind: 'HEAL',
    formula: '1d8',
    damageType: 'untyped',
    addSpellcastingModifier: true,
    save: null,
    attack: null,
    upcast: { formula: '1d8' },
    targets: 'SINGLE',
  },
  'curar feridas': {
    kind: 'HEAL',
    formula: '1d8',
    damageType: 'untyped',
    addSpellcastingModifier: true,
    save: null,
    attack: null,
    upcast: { formula: '1d8' },
    targets: 'SINGLE',
  },
  'bola de fogo': {
    kind: 'DAMAGE',
    formula: '8d6',
    damageType: 'fire',
    addSpellcastingModifier: false,
    save: { ability: 'DEX', halfOnSuccess: true },
    attack: null,
    upcast: { formula: '1d6' },
    targets: 'MULTIPLE',
  },
  'raio de fogo': {
    kind: 'DAMAGE',
    formula: '1d10',
    damageType: 'fire',
    addSpellcastingModifier: false,
    save: null,
    attack: 'SPELL',
    upcast: null,
    targets: 'SINGLE',
  },
  'marca do cacador': {
    kind: 'MARK',
    formula: '0',
    damageType: 'untyped',
    addSpellcastingModifier: false,
    save: null,
    attack: null,
    upcast: null,
    targets: 'SINGLE',
    concentration: {
      condition: 'Marcado',
      bonusFormula: '1d6',
      durationMinutes: 60,
    },
  },
};

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function validFormula(value: string): boolean {
  return FORMULA.test(value);
}

/** Lê `Spell.mechanics`; nomes conhecidos têm fallback para o catálogo atual. */
export function resolveSpellMechanics(spell: {
  name: string;
  mechanics?: string | null;
}): SpellMechanics | null {
  const parsed = parseJson(spell.mechanics ?? null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const kind =
      record.kind === 'HEAL' ||
      record.kind === 'DAMAGE' ||
      record.kind === 'MARK'
        ? record.kind
        : null;
    const formula =
      typeof record.formula === 'string' && validFormula(record.formula)
        ? record.formula.toLowerCase()
        : kind === 'MARK'
          ? '0'
          : null;
    if (kind && formula) {
      const save =
        record.save && typeof record.save === 'object'
          ? (record.save as Record<string, unknown>)
          : null;
      const upcast =
        record.upcast && typeof record.upcast === 'object'
          ? (record.upcast as Record<string, unknown>)
          : null;
      const concentration =
        record.concentration && typeof record.concentration === 'object'
          ? (record.concentration as Record<string, unknown>)
          : null;
      const ability =
        typeof save?.ability === 'string' &&
        ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(save.ability)
          ? (save.ability as SpellAbility)
          : null;
      return {
        kind,
        formula,
        damageType:
          typeof record.damageType === 'string' &&
          (DAMAGE_TYPES as readonly string[]).includes(record.damageType)
            ? (record.damageType as DamageType)
            : 'untyped',
        addSpellcastingModifier: record.addSpellcastingModifier === true,
        save: ability
          ? { ability, halfOnSuccess: save?.halfOnSuccess === true }
          : null,
        attack: record.attack === 'SPELL' ? 'SPELL' : null,
        upcast:
          upcast &&
          typeof upcast.formula === 'string' &&
          validFormula(upcast.formula)
            ? { formula: upcast.formula.toLowerCase() }
            : null,
        targets: record.targets === 'SINGLE' ? 'SINGLE' : 'MULTIPLE',
        concentration:
          concentration &&
          typeof concentration.condition === 'string' &&
          typeof concentration.bonusFormula === 'string' &&
          validFormula(concentration.bonusFormula) &&
          typeof concentration.durationMinutes === 'number'
            ? {
                condition: concentration.condition,
                bonusFormula: concentration.bonusFormula.toLowerCase(),
                durationMinutes: concentration.durationMinutes,
              }
            : null,
      };
    }
  }
  return FALLBACKS[normalizeName(spell.name)] ?? null;
}

export function spellToHud(
  characterSpellId: string,
  spell: {
    id: string;
    name: string;
    level: number;
    school: string;
    concentration: boolean;
    description: string | null;
    mechanics?: string | null;
  },
): SpellHud | null {
  const mechanics = resolveSpellMechanics(spell);
  if (!mechanics) return null;
  return {
    characterSpellId,
    spellId: spell.id,
    name: spell.name,
    level: spell.level,
    school: spell.school,
    concentration: spell.concentration || Boolean(mechanics.concentration),
    description: spell.description,
    effectKind: mechanics.kind,
    saveAbility: mechanics.save?.ability ?? null,
    halfOnSuccess: mechanics.save?.halfOnSuccess ?? false,
    attack: mechanics.attack === 'SPELL',
    targetMode: mechanics.targets,
    formula: mechanics.formula,
    upcastFormula: mechanics.upcast?.formula ?? null,
  };
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function spellcastingAbility(characterClass: string): SpellAbility {
  const normalized = normalizeName(characterClass);
  if (['clerigo', 'druida', 'patrulheiro'].includes(normalized)) return 'WIS';
  if (['bardo', 'bruxo', 'feiticeiro', 'paladino'].includes(normalized))
    return 'CHA';
  return 'INT';
}

export function spellcastingModifier(character: {
  class: string;
  intelligence: number;
  wisdom: number;
  charisma: number;
}): number {
  const ability = spellcastingAbility(character.class);
  const score =
    ability === 'WIS'
      ? character.wisdom
      : ability === 'CHA'
        ? character.charisma
        : character.intelligence;
  return abilityModifier(score);
}

export function spellSaveDc(
  proficiencyBonus: number,
  modifier: number,
): number {
  return 8 + proficiencyBonus + modifier;
}
