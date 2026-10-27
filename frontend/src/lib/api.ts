const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Sessão expirada ou inválida: quem mantém o login registra o que fazer
// (sair e voltar à tela de entrada). Fica aqui para não importar a store.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Cancelamento vindo do React Query (ou de outro chamador). */
  signal?: AbortSignal;
}

/**
 * Toda requisição tem teto de 15 s. Sem isso, uma resposta pendente deixava a
 * tela em "Carregando..." para sempre. O sinal do chamador continua valendo.
 */
function withTimeout(signal?: AbortSignal): AbortSignal {
  if (typeof AbortSignal.timeout !== 'function') {
    return signal ?? new AbortController().signal;
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal) return timeout;

  const anySignal = (
    AbortSignal as unknown as {
      any?: (signals: AbortSignal[]) => AbortSignal;
    }
  ).any;

  return anySignal ? anySignal([signal, timeout]) : signal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: withTimeout(options.signal),
    });
  } catch (error) {
    // Cancelamento pedido pelo chamador (troca de tela/filtro) não é falha.
    if (options.signal?.aborted) throw error;
    if (
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new ApiError('A requisição demorou demais. Tente novamente.', 0);
    }
    throw error;
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message ?? message;
    } catch {
      // ignore - fallback to statusText
    }
    // 401 com token enviado = sessão vencida ou revogada. Sem token (ex.: login
    // com senha errada) o erro segue normal para a tela tratar.
    if (response.status === 401 && options.token) unauthorizedHandler?.();
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(path: string, token?: string | null, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', token, signal }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body, token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body, token }),
  put: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PUT', body, token }),
  delete: <T>(path: string, token?: string | null) => request<T>(path, { method: 'DELETE', token }),
};
