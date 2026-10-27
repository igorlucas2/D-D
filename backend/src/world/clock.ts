export interface AutoTickSchedule {
  realMinutesPerTick: number;
  gameMinutesPerTick: number;
  lastTickAt: Date | null;
  /** Fallback para calendários anteriores à coluna lastTickAt. */
  updatedAt: Date;
}

export interface AutoTickPlan {
  /** Quantos intervalos vencem nesta execução (1..maxTicks). */
  intervals: number;
  /** Novo `lastTickAt`, sempre múltiplo do intervalo a partir da base. */
  nextTickAt: Date;
  minutesToAdd: number;
}

/** Teto de ticks recuperados em uma execução. */
export const MAX_AUTO_TICKS_PER_RUN = 24;

/**
 * Decide se o relógio automático deve avançar e quanto. Função pura para
 * testar o cálculo sem banco; a exclusão mútua fica no CAS de lastTickAt.
 */
export function planAutoTick(
  schedule: AutoTickSchedule,
  now = Date.now(),
  maxTicks = MAX_AUTO_TICKS_PER_RUN,
): AutoTickPlan | null {
  const intervalMs = Math.max(1, schedule.realMinutesPerTick) * 60_000;
  const base = (schedule.lastTickAt ?? schedule.updatedAt).getTime();
  const elapsed = now - base;
  if (elapsed < intervalMs) return null;

  const intervals = Math.min(maxTicks, Math.floor(elapsed / intervalMs));
  return {
    intervals,
    nextTickAt: new Date(base + intervals * intervalMs),
    minutesToAdd: intervals * Math.max(0, schedule.gameMinutesPerTick),
  };
}
