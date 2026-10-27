import {
  expiryToMillis,
  isSessionExpired,
  millisecondsUntilExpiry,
} from './session';

describe('expiração de sessão', () => {
  it('converte o exp do JWT para milissegundos', () => {
    expect(expiryToMillis(1_700_000_000)).toBe(1_700_000_000_000);
  });

  it('trata exp ausente ou inválido como zero', () => {
    expect(expiryToMillis(undefined)).toBe(0);
    expect(expiryToMillis(0)).toBe(0);
    expect(expiryToMillis(Number.NaN)).toBe(0);
    expect(expiryToMillis(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('considera expirado a partir do instante de vencimento', () => {
    expect(isSessionExpired(1_000, 999)).toBe(false);
    expect(isSessionExpired(1_000, 1_000)).toBe(true);
    expect(isSessionExpired(1_000, 1_001)).toBe(true);
  });

  it('trata socket sem prazo como expirado', () => {
    expect(isSessionExpired(undefined)).toBe(true);
    expect(isSessionExpired(0)).toBe(true);
    expect(isSessionExpired(Number.NaN)).toBe(true);
  });

  it('calcula o tempo restante sem negativo', () => {
    expect(millisecondsUntilExpiry(5_000, 1_000)).toBe(4_000);
    expect(millisecondsUntilExpiry(1_000, 5_000)).toBe(0);
  });
});
