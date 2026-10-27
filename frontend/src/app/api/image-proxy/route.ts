import { NextRequest, NextResponse } from "next/server";
import { ImageProxyError, assertSafeImageUrl } from "@/lib/image-proxy-guard";

// Repassa imagens externas (mapas/tokens) com os cabeçalhos que o three.js
// precisa para usá-las como textura WebGL. A origem é validada em cada salto:
// só http(s), só portas 80/443, nenhum endereço interno e nenhum redirecionamento
// para a rede local. SVG fica de fora porque executaria script na nossa origem.
//
// Limitação conhecida: entre a resolução DNS e o fetch o endereço pode mudar
// (DNS rebinding). Para um ambiente hostil, coloque o proxy atrás de uma saída
// com allowlist de IP.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const hits = new Map<string, number[]>();

function clientKey(request: NextRequest): string {
  // Cloudflare sobrescreve CF-Connecting-IP; é a fonte mais confiável quando
  // existe. Sem ele, cai para os cabeçalhos usuais de proxy.
  const cloudflare = request.headers.get("cf-connecting-ip");
  if (cloudflare) return cloudflare;

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "local";
}

/** Janela deslizante simples em memória (uma instância do Next). */
function isRateLimited(key: string, now = Date.now()): boolean {
  const windowStart = now - RATE_WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((time) => time > windowStart);

  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5_000) {
    for (const [entry, times] of hits) {
      if (times.every((time) => time <= windowStart)) hits.delete(entry);
    }
  }

  return false;
}

function fail(status: number, message: string) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function forward(upstream: Response) {
  if (!upstream.ok || !upstream.body) {
    return fail(
      upstream.status === 404 ? 404 : 502,
      upstream.status === 404
        ? "Imagem não encontrada."
        : "Imagem indisponível.",
    );
  }

  const contentType = (upstream.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!ALLOWED_TYPES.has(contentType)) {
    return fail(415, "Recurso não é uma imagem suportada.");
  }

  const declared = Number(upstream.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return fail(413, "Imagem grande demais.");
  }

  const reader = upstream.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return fail(413, "Imagem grande demais.");
      }
      parts.push(value);
    }
  } catch {
    return fail(502, "Falha ao ler a imagem.");
  }

  const body = new Uint8Array(
    Buffer.concat(parts.map((part) => Buffer.from(part))),
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

export async function GET(request: NextRequest) {
  if (isRateLimited(clientKey(request))) {
    return fail(
      429,
      "Muitas imagens em pouco tempo. Tente de novo em instantes.",
    );
  }

  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return fail(400, "Parâmetro 'url' obrigatório.");
  }

  try {
    let target = await assertSafeImageUrl(raw);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const upstream = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
        headers: {
          Accept:
            "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
          "User-Agent": "EldoriaImageProxy/1.0",
        },
      });

      if (REDIRECT_STATUSES.has(upstream.status)) {
        const location = upstream.headers.get("location");
        await upstream.body?.cancel();
        if (!location) return fail(502, "Redirecionamento sem destino.");
        target = await assertSafeImageUrl(new URL(location, target).toString());
        continue;
      }

      return await forward(upstream);
    }

    return fail(502, "Redirecionamentos demais.");
  } catch (error) {
    if (error instanceof ImageProxyError) {
      return fail(error.status, error.message);
    }
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return fail(504, "A origem demorou demais para responder.");
    }
    return fail(502, "Não foi possível buscar a imagem.");
  }
}
