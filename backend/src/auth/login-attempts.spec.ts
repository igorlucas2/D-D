import { LoginAttemptTracker } from './login-attempts';

describe('LoginAttemptTracker', () => {
  const policy = {
    maxFailures: 3,
    windowMs: 60_000,
    blockMs: 30_000,
  };

  it('bloqueia depois do limite e libera após o tempo de bloqueio', () => {
    const tracker = new LoginAttemptTracker(policy);
    const start = 1_000_000;

    tracker.registerFailure('a@example.com', start);
    tracker.registerFailure('a@example.com', start + 1);
    expect(tracker.isBlocked('a@example.com', start + 2)).toBe(false);

    tracker.registerFailure('a@example.com', start + 3);
    expect(tracker.isBlocked('a@example.com', start + 4)).toBe(true);
    // O bloqueio começa em start + 3 e dura blockMs (30 s): vale até o instante
    // anterior ao fim e libera exatamente no fim.
    expect(tracker.isBlocked('a@example.com', start + 30_002)).toBe(true);
    expect(tracker.isBlocked('a@example.com', start + 30_003)).toBe(false);
  });

  it('zera o contador depois de um login bem-sucedido', () => {
    const tracker = new LoginAttemptTracker(policy);
    const now = 5_000_000;

    tracker.registerFailure('b@example.com', now);
    tracker.registerFailure('b@example.com', now + 1);
    tracker.reset('b@example.com');
    tracker.registerFailure('b@example.com', now + 2);

    expect(tracker.isBlocked('b@example.com', now + 3)).toBe(false);
  });

  it('não acumula falhas fora da janela', () => {
    const tracker = new LoginAttemptTracker(policy);
    const now = 9_000_000;

    tracker.registerFailure('c@example.com', now);
    tracker.registerFailure('c@example.com', now + 1);
    tracker.registerFailure('c@example.com', now + policy.windowMs + 1);

    expect(tracker.isBlocked('c@example.com', now + policy.windowMs + 2)).toBe(
      false,
    );
  });

  it('trata cada e-mail de forma independente', () => {
    const tracker = new LoginAttemptTracker(policy);
    const now = 12_000_000;

    for (let index = 0; index < policy.maxFailures; index += 1) {
      tracker.registerFailure('bloqueado@example.com', now + index);
    }

    expect(tracker.isBlocked('bloqueado@example.com', now + 10)).toBe(true);
    expect(tracker.isBlocked('outro@example.com', now + 10)).toBe(false);
  });
});
