/**
 * Espelha backend/src/characters/rules/character-rules.ts para permitir
 * preview em tempo real no wizard de criação de personagem.
 */

export interface BaseAttributes {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SpellSlotProgression {
  level: number;
  total: number;
}

export const HIT_DIE_BY_CLASS: Record<string, number> = {
  Barbaro: 12,
  Guerreiro: 10,
  Paladino: 10,
  Patrulheiro: 10,
  Clerigo: 8,
  Druida: 8,
  Monge: 8,
  Ladino: 8,
  Bardo: 8,
  Bruxo: 8,
  Feiticeiro: 6,
  Mago: 6,
};

const FULL_CASTER_CLASSES = new Set([
  'Mago',
  'Clerigo',
  'Druida',
  'Bardo',
  'Feiticeiro',
]);

const HALF_CASTER_CLASSES = new Set(['Paladino', 'Patrulheiro']);

const FULL_CASTER_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const HALF_CASTER_SLOTS: number[][] = [
  [0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

const WARLOCK_PACT_SLOTS: Record<number, SpellSlotProgression> = {
  1: { level: 1, total: 1 },
  2: { level: 1, total: 2 },
  3: { level: 2, total: 2 },
  4: { level: 2, total: 2 },
  5: { level: 3, total: 2 },
  6: { level: 3, total: 2 },
  7: { level: 4, total: 2 },
  8: { level: 4, total: 2 },
  9: { level: 5, total: 2 },
  10: { level: 5, total: 2 },
  11: { level: 5, total: 3 },
  12: { level: 5, total: 3 },
  13: { level: 5, total: 3 },
  14: { level: 5, total: 3 },
  15: { level: 5, total: 3 },
  16: { level: 5, total: 3 },
  17: { level: 5, total: 4 },
  18: { level: 5, total: 4 },
  19: { level: 5, total: 4 },
  20: { level: 5, total: 4 },
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(level, 1) - 1) / 4);
}

export function calculateSpellSlots(className: string, level: number): SpellSlotProgression[] {
  const safeLevel = Math.max(1, Math.min(level, 20));

  if (className === 'Bruxo') {
    const pactSlot = WARLOCK_PACT_SLOTS[safeLevel];
    return Array.from({ length: 9 }, (_, index) => ({
      level: index + 1,
      total: pactSlot.level === index + 1 ? pactSlot.total : 0,
    }));
  }

  const slots = FULL_CASTER_CLASSES.has(className)
    ? FULL_CASTER_SLOTS[safeLevel - 1]
    : HALF_CASTER_CLASSES.has(className)
      ? HALF_CASTER_SLOTS[safeLevel - 1]
      : [];

  return Array.from({ length: 9 }, (_, index) => ({
    level: index + 1,
    total: slots[index] ?? 0,
  }));
}

export function calculateDerivedStats(attributes: BaseAttributes, level: number, className: string) {
  const modifiers = {
    strength: abilityModifier(attributes.strength),
    dexterity: abilityModifier(attributes.dexterity),
    constitution: abilityModifier(attributes.constitution),
    intelligence: abilityModifier(attributes.intelligence),
    wisdom: abilityModifier(attributes.wisdom),
    charisma: abilityModifier(attributes.charisma),
  };

  const profBonus = proficiencyBonus(level);
  const hitDie = HIT_DIE_BY_CLASS[className] ?? 8;
  const hpPerLevel = Math.floor(hitDie / 2) + 1 + modifiers.constitution;
  const maxHp = Math.max(1, hpPerLevel * level);

  const armorClass = 10 + modifiers.dexterity;
  const initiative = modifiers.dexterity;

  return { modifiers, proficiencyBonus: profBonus, armorClass, initiative, maxHp };
}

/** Sistema "compra de pontos": custo cumulativo para subir de 8 até 15 */
export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const POINT_BUY_BUDGET = 27;

export function pointBuyCost(attributes: BaseAttributes): number {
  return Object.values(attributes).reduce((sum, score) => sum + (POINT_BUY_COST[score] ?? 0), 0);
}
