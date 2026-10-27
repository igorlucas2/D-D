import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export class ImageProxyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ImageProxyError";
    this.status = status;
  }
}

/**
 * Hosts permitidos, separados por vírgula. Aceita `example.com` (exato) e
 * `*.example.com` (subdomínios). Vazio = qualquer host público.
 */
export function allowedHosts(
  raw = process.env.IMAGE_PROXY_ALLOWED_HOSTS,
): string[] {
  return (raw ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return null;
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return null;
  return parts;
}

function isPublicIpv4(address: string): boolean {
  const parts = parseIpv4(address);
  if (!parts) return false;

  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return false; // this-net, privado, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false; // link-local (metadados de nuvem)
  if (a === 172 && b >= 16 && b <= 31) return false; // privado
  if (a === 192 && b === 168) return false; // privado
  if (a === 192 && b === 0 && c === 0) return false; // IETF
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay
  if (a === 192 && b === 0 && c === 2) return false; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmark
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reservado e broadcast

  return true;
}

function isPublicIpv6(address: string): boolean {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return false;

  const mappedDotted = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedDotted) return isPublicIpv4(mappedDotted[1]);

  const mappedHex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isPublicIpv4(
      `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`,
    );
  }

  if (value.startsWith("64:ff9b:")) return false; // NAT64

  const first = Number.parseInt(value.split(":")[0] || "0", 16);
  if (Number.isNaN(first)) return false;
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 (único local)
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 (link-local)
  if ((first & 0xff00) === 0xff00) return false; // ff00::/8 (multicast)
  if (first === 0) return false; // ::/8 reservado

  return true;
}

/** Rejeita loopback, rede privada, link-local, multicast e reservados. */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

function hostMatches(hostname: string, pattern: string): boolean {
  const clean = pattern.replace(/^\./, "");
  if (clean.startsWith("*.")) {
    const suffix = clean.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }
  return hostname === clean;
}

function isHostAllowed(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.some((pattern) => hostMatches(hostname, pattern));
}

/**
 * Valida a URL pedida e resolve o host, garantindo que nenhum endereço final
 * seja interno. É chamada de novo a cada redirecionamento.
 */
export async function assertSafeImageUrl(
  raw: string,
  options: { allowlist?: string[] } = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageProxyError(400, "URL inválida.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new ImageProxyError(400, "Protocolo não suportado.");
  }
  if (url.username || url.password) {
    throw new ImageProxyError(400, "URL com credenciais não é aceita.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ImageProxyError(403, "Porta não permitida.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const allowlist = options.allowlist ?? allowedHosts();
  if (!isHostAllowed(hostname, allowlist)) {
    throw new ImageProxyError(403, "Host não autorizado.");
  }

  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) {
      throw new ImageProxyError(403, "Endereço interno não é permitido.");
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ImageProxyError(502, "Não foi possível resolver o host.");
  }

  if (addresses.length === 0) {
    throw new ImageProxyError(502, "Host sem endereço.");
  }
  if (addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new ImageProxyError(403, "Endereço interno não é permitido.");
  }

  return url;
}
