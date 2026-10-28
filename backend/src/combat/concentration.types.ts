import { parseJson } from '../common/json';

export interface ConcentrationTarget {
  kind: 'CHARACTER' | 'PARTICIPANT';
  id: string;
  name: string;
}

export interface ConcentrationState {
  spellId: string;
  spellName: string;
  targets: ConcentrationTarget[];
  condition: string;
  bonusFormula: string;
  startedAt: string;
  expiresAt: string;
}

function target(value: unknown): ConcentrationTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    (record.kind !== 'CHARACTER' && record.kind !== 'PARTICIPANT') ||
    typeof record.id !== 'string' ||
    typeof record.name !== 'string'
  )
    return null;
  return { kind: record.kind, id: record.id, name: record.name };
}

export function parseConcentrationState(
  value: string | null | undefined,
): ConcentrationState | null {
  const data = parseJson(value ?? null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const targets = Array.isArray(record.targets)
    ? record.targets
        .map(target)
        .filter((item): item is ConcentrationTarget => Boolean(item))
    : [];
  const legacy = target({
    kind: record.targetKind,
    id: record.targetId,
    name: record.targetName,
  });
  const resolvedTargets = targets.length ? targets : legacy ? [legacy] : [];
  if (
    typeof record.spellId !== 'string' ||
    typeof record.spellName !== 'string' ||
    resolvedTargets.length === 0 ||
    typeof record.condition !== 'string' ||
    typeof record.bonusFormula !== 'string' ||
    typeof record.startedAt !== 'string' ||
    typeof record.expiresAt !== 'string'
  )
    return null;
  return {
    spellId: record.spellId,
    spellName: record.spellName,
    targets: resolvedTargets,
    condition: record.condition,
    bonusFormula: record.bonusFormula,
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
  };
}
