/**
 * Leitura tolerante de JSON legado guardado em colunas de texto.
 *
 * Vários campos do schema guardam JSON serializado (`LongText`). Uma linha
 * corrompida não deve derrubar a requisição com 500: o chamador recebe um
 * valor vazio e pode seguir com o padrão.
 */
export function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function parseJsonArray(value: string | null | undefined): unknown[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

export function parseStringArray(value: string | null | undefined): string[] {
  return parseJsonArray(value).filter(
    (item): item is string => typeof item === 'string',
  );
}

export function parseNumberArray(value: string | null | undefined): number[] {
  return parseJsonArray(value).filter(
    (item): item is number => typeof item === 'number' && Number.isFinite(item),
  );
}

export function parseJsonObject(
  value: string | null | undefined,
): Record<string, unknown> | null {
  const parsed = parseJson(value);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}
