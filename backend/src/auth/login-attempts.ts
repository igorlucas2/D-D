export interface LoginAttemptPolicy {
  readonly maxFailures: number;
  readonly windowMs: number;
  readonly blockMs: number;
}

const DEFAULT_POLICY: LoginAttemptPolicy = {
  maxFailures: 10,
  windowMs: 15 * 60_000,
  blockMs: 15 * 60_000,
};

interface FailureWindow {
  count: number;
  firstAt: number;
}

/**
 * Bloqueio temporário por e-mail depois de muitas senhas erradas.
 *
 * Complementa o limite por IP do ThrottlerGuard: distribuído entre vários IPs,
 * o ataque contra uma conta específica ainda esbarra aqui. O estado é em
 * memória (uma instância); ao escalar, trocar por Redis.
 */
export class LoginAttemptTracker {
  private readonly failures = new Map<string, FailureWindow>();
  private readonly blockedUntil = new Map<string, number>();

  constructor(private readonly policy: LoginAttemptPolicy = DEFAULT_POLICY) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const until = this.blockedUntil.get(key);
    if (until === undefined) return false;
    if (until > now) return true;
    this.blockedUntil.delete(key);
    return false;
  }

  registerFailure(key: string, now = Date.now()): void {
    if (this.isBlocked(key, now)) return;

    const current = this.failures.get(key);
    if (!current || now - current.firstAt > this.policy.windowMs) {
      this.failures.set(key, { count: 1, firstAt: now });
      return;
    }

    const count = current.count + 1;
    if (count >= this.policy.maxFailures) {
      this.failures.delete(key);
      this.blockedUntil.set(key, now + this.policy.blockMs);
      this.prune(now);
      return;
    }

    current.count = count;
  }

  reset(key: string): void {
    this.failures.delete(key);
    this.blockedUntil.delete(key);
  }

  /** Evita crescimento sem limite quando muitos e-mails distintos falham. */
  private prune(now: number): void {
    if (this.failures.size < 10_000 && this.blockedUntil.size < 10_000) return;

    for (const [key, window] of this.failures) {
      if (now - window.firstAt > this.policy.windowMs)
        this.failures.delete(key);
    }
    for (const [key, until] of this.blockedUntil) {
      if (until <= now) this.blockedUntil.delete(key);
    }
  }
}
