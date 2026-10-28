import { parseJson } from '../common/json';

export interface TimedCondition {
  name: string;
  remainingRounds: number;
  source: string | null;
}

export function parseTimedConditions(
  value: string | null | undefined,
): TimedCondition[] {
  const data = parseJson(value ?? null);
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      if (
        typeof record.name !== 'string' ||
        typeof record.remainingRounds !== 'number' ||
        !Number.isFinite(record.remainingRounds)
      )
        return null;
      return {
        name: record.name,
        remainingRounds: Math.max(0, Math.floor(record.remainingRounds)),
        source: typeof record.source === 'string' ? record.source : null,
      };
    })
    .filter((item): item is TimedCondition => Boolean(item));
}

function sameName(a: string, b: string): boolean {
  return (
    a
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() ===
    b
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  );
}

export function addTimedCondition(
  list: TimedCondition[],
  name: string,
  rounds: number,
  source: string | null,
): TimedCondition[] {
  return [
    ...list.filter((item) => !sameName(item.name, name)),
    { name, remainingRounds: Math.max(1, Math.floor(rounds)), source },
  ];
}

export function removeTimedCondition(
  list: TimedCondition[],
  name: string,
): TimedCondition[] {
  return list.filter((item) => !sameName(item.name, name));
}

export function tickTimedConditions(list: TimedCondition[]): {
  remaining: TimedCondition[];
  expired: string[];
} {
  const remaining: TimedCondition[] = [];
  const expired: string[] = [];
  for (const item of list) {
    const next = item.remainingRounds - 1;
    if (next <= 0) expired.push(item.name);
    else remaining.push({ ...item, remainingRounds: next });
  }
  return { remaining, expired };
}
