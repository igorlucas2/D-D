import { parseJson } from '../common/json';

export interface ConcentrationState {
  spellId: string;
  spellName: string;
  targetKind: 'CHARACTER' | 'PARTICIPANT';
  targetId: string;
  targetName: string;
  condition: string;
  bonusFormula: string;
  startedAt: string;
  expiresAt: string;
}

export function parseConcentrationState(
  value: string | null | undefined,
): ConcentrationState | null {
  const data = parseJson(value ?? null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (
    typeof record.spellId !== 'string' ||
    typeof record.spellName !== 'string' ||
    (record.targetKind !== 'CHARACTER' &&
      record.targetKind !== 'PARTICIPANT') ||
    typeof record.targetId !== 'string' ||
    typeof record.targetName !== 'string' ||
    typeof record.condition !== 'string' ||
    typeof record.bonusFormula !== 'string' ||
    typeof record.startedAt !== 'string' ||
    typeof record.expiresAt !== 'string'
  )
    return null;
  return {
    spellId: record.spellId,
    spellName: record.spellName,
    targetKind: record.targetKind,
    targetId: record.targetId,
    targetName: record.targetName,
    condition: record.condition,
    bonusFormula: record.bonusFormula,
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
  };
}
