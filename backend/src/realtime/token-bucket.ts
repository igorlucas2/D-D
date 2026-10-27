export interface BucketState {
  tokens: number;
  /** Último instante em que o balde foi recalculado. */
  updatedAt: number;
}

export interface TakeTokenResult {
  allowed: boolean;
  state: BucketState;
}

function refill(
  state: BucketState,
  capacity: number,
  refillIntervalMs: number,
  now: number,
): BucketState {
  const elapsed = now - state.updatedAt;
  if (elapsed < refillIntervalMs) return state;

  const gained = Math.floor(elapsed / refillIntervalMs);
  return {
    tokens: Math.min(capacity, state.tokens + gained),
    updatedAt: state.updatedAt + gained * refillIntervalMs,
  };
}

/**
 * Token bucket simples por chave (um balde por evento e socket). Sem estado
 * externo: reinicia com o processo, como a presença em memória.
 */
export function takeToken(
  state: BucketState | undefined,
  capacity: number,
  refillIntervalMs: number,
  now = Date.now(),
): TakeTokenResult {
  const current = state
    ? refill(state, capacity, refillIntervalMs, now)
    : { tokens: capacity, updatedAt: now };

  if (current.tokens < 1) {
    return { allowed: false, state: current };
  }

  return {
    allowed: true,
    state: { tokens: current.tokens - 1, updatedAt: current.updatedAt },
  };
}
