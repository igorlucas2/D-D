/**
 * Origens autorizadas para CORS (HTTP) e para o handshake do Socket.IO.
 *
 * O navegador fala só com o Next (mesma origem), mas o proxy repassa o
 * cabeçalho `Origin` recebido do navegador — então o backend ainda precisa
 * reconhecer de onde veio a requisição. Por padrão liberamos apenas localhost;
 * túnel e domínio próprio entram por ELDORIA_ALLOWED_ORIGINS ou
 * ELDORIA_PUBLIC_HOSTS, nunca por "*".
 *
 * As funções leem o ambiente na hora da chamada porque os decorators dos
 * gateways são avaliados antes de o ConfigModule carregar o .env.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://[::1]:3000',
];

type StaticOrigin = boolean | string | RegExp | (string | RegExp)[];

function normalize(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(',').map(normalize).filter(Boolean);
}

function stripScheme(host: string): string {
  return host.replace(/^https?:\/\//, '');
}

function withHttps(entry: string): string {
  return entry.includes('://') ? entry : `https://${entry}`;
}

/** Origens explícitas do .env (aceita host sem esquema, assume https). */
export function configuredOrigins(): string[] {
  return splitList(process.env.ELDORIA_ALLOWED_ORIGINS).map(withHttps);
}

/** Hosts do túnel (ELDORIA_PUBLIC_HOSTS) valem em http e https. */
export function publicHostOrigins(): string[] {
  return splitList(process.env.ELDORIA_PUBLIC_HOSTS).flatMap((host) => [
    `https://${stripScheme(host)}`,
    `http://${stripScheme(host)}`,
  ]);
}

export function allowedOrigins(): string[] {
  return [
    ...new Set([
      ...DEV_ORIGINS,
      ...configuredOrigins(),
      ...publicHostOrigins(),
    ]),
  ];
}

function hostnameOf(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** Origens públicas aceitas, comparadas por hostname (qualquer porta). */
function publicHostnames(): string[] {
  return splitList(process.env.ELDORIA_PUBLIC_HOSTS)
    .map((host) => hostnameOf(withHttps(host)) ?? stripScheme(host))
    .filter(Boolean);
}

export function isOriginAllowed(origin?: string | null): boolean {
  // Sem Origin: health check, CLI, chamada servidor-a-servidor (Next proxy).
  if (!origin) return true;

  const normalized = normalize(origin);
  if (allowedOrigins().includes(normalized)) return true;

  const hostname = hostnameOf(normalized);
  if (!hostname) return false;
  if (LOCAL_HOSTNAMES.has(hostname)) return true;

  return publicHostnames().includes(hostname);
}

export const gatewayCors = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: StaticOrigin) => void,
  ) => callback(null, isOriginAllowed(origin)),
  credentials: false,
};

export function gatewayAllowRequest(
  request: { headers?: { origin?: string } },
  callback: (err: string | null, success: boolean) => void,
) {
  callback(null, isOriginAllowed(request.headers?.origin));
}
