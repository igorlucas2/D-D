/** Expiração de sessão em milissegundos, derivada do `exp` do JWT. */
export function expiryToMillis(exp: number | undefined): number {
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) return 0;
  return exp * 1000;
}

/** Sem `exp` válido também conta como expirado: socket sem prazo não é aceito. */
export function isSessionExpired(
  expiresAtMs: number | undefined,
  now = Date.now(),
): boolean {
  if (!expiresAtMs || !Number.isFinite(expiresAtMs)) return true;
  return expiresAtMs <= now;
}

/** Quanto falta para expirar; 0 quando já passou. */
export function millisecondsUntilExpiry(
  expiresAtMs: number,
  now = Date.now(),
): number {
  return Math.max(0, expiresAtMs - now);
}
