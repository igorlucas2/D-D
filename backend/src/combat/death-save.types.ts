export type DeathSaveOutcome = 'REVIVED' | 'STABLE' | 'DEAD' | 'PENDING';

export interface DeathSaveState {
  roll: number;
  successes: number;
  failures: number;
  stable: boolean;
  dead: boolean;
  revived: boolean;
  outcome: DeathSaveOutcome;
}

export interface DeathSaveResult {
  actionId: string;
  requestKey: string;
  kind: 'DEATH_SAVE';
  target: {
    kind: 'PARTICIPANT';
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
  outcome: DeathSaveOutcome;
  hpBefore: { current: number; max: number; temp: number };
  hpAfter: { current: number; max: number; temp: number };
  alreadyApplied: boolean;
  createdAt: string;
}

/**
 * Regras de salvaguarda contra morte:
 * 20 = revive com 1 PV; 1 = duas falhas; 2-9 = uma falha; 10-19 = um sucesso.
 */
export function resolveDeathSave(
  roll: number,
  successes: number,
  failures: number,
): DeathSaveState {
  if (roll === 20) {
    return {
      roll,
      successes: 0,
      failures: 0,
      stable: false,
      dead: false,
      revived: true,
      outcome: 'REVIVED',
    };
  }
  let nextSuccesses = successes;
  let nextFailures = failures;
  if (roll === 1) nextFailures += 2;
  else if (roll <= 9) nextFailures += 1;
  else nextSuccesses += 1;
  nextSuccesses = Math.min(3, nextSuccesses);
  nextFailures = Math.min(3, nextFailures);
  if (nextFailures >= 3) {
    return {
      roll,
      successes: nextSuccesses,
      failures: 3,
      stable: false,
      dead: true,
      revived: false,
      outcome: 'DEAD',
    };
  }
  if (nextSuccesses >= 3) {
    return {
      roll,
      successes: 3,
      failures: nextFailures,
      stable: true,
      dead: false,
      revived: false,
      outcome: 'STABLE',
    };
  }
  return {
    roll,
    successes: nextSuccesses,
    failures: nextFailures,
    stable: false,
    dead: false,
    revived: false,
    outcome: 'PENDING',
  };
}
