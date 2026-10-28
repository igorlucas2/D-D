export type DamageDefenseType = 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY';

export interface DamageDefense {
  type: DamageDefenseType | null;
  original: number;
  adjusted: number;
  multiplier: number;
}

export interface ResistanceEntry {
  damageType: string;
  type: DamageDefenseType;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const LABELS: Record<string, string> = {
  fogo: 'fire',
  gelo: 'cold',
  frio: 'cold',
  acido: 'acid',
  trovejante: 'thunder',
  relampago: 'lightning',
  raio: 'lightning',
  veneno: 'poison',
  psiquico: 'psychic',
  radiante: 'radiant',
  necrotico: 'necrotic',
  forca: 'force',
  contundente: 'bludgeoning',
  concussao: 'bludgeoning',
  perfurante: 'piercing',
  perfuracao: 'piercing',
  cortante: 'slashing',
  corte: 'slashing',
};

export function normalizeDamageType(value: string): string {
  const normalized = normalize(value);
  return LABELS[normalized] ?? normalized;
}

export function parseDamageDefenses(
  value: string | null | undefined,
): ResistanceEntry[] {
  if (!value) return [];
  try {
    const data = JSON.parse(value) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
          return null;
        const record = item as Record<string, unknown>;
        if (
          typeof record.damageType !== 'string' ||
          (record.type !== 'RESISTANCE' &&
            record.type !== 'IMMUNITY' &&
            record.type !== 'VULNERABILITY')
        )
          return null;
        return {
          damageType: record.damageType,
          type: record.type,
        };
      })
      .filter((item): item is ResistanceEntry => Boolean(item));
  } catch {
    return [];
  }
}

export function resolveDamageDefense(
  amount: number,
  damageType: string | null | undefined,
  entries: ResistanceEntry[],
): DamageDefense {
  const original = Math.max(0, Math.floor(amount));
  if (!damageType)
    return { type: null, original, adjusted: original, multiplier: 1 };
  const type = normalizeDamageType(damageType);
  const relevant = entries.filter(
    (entry) => normalizeDamageType(entry.damageType) === type,
  );
  if (relevant.some((entry) => entry.type === 'IMMUNITY'))
    return { type: 'IMMUNITY', original, adjusted: 0, multiplier: 0 };
  const resistant = relevant.some((entry) => entry.type === 'RESISTANCE');
  const vulnerable = relevant.some((entry) => entry.type === 'VULNERABILITY');
  if (resistant && vulnerable)
    return { type: null, original, adjusted: original, multiplier: 1 };
  if (resistant)
    return {
      type: 'RESISTANCE',
      original,
      adjusted: Math.floor(original / 2),
      multiplier: 0.5,
    };
  if (vulnerable)
    return {
      type: 'VULNERABILITY',
      original,
      adjusted: original * 2,
      multiplier: 2,
    };
  return { type: null, original, adjusted: original, multiplier: 1 };
}
