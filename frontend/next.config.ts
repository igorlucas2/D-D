import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// O next.config é lido antes de o Next carregar o .env.local; carregamos aqui
// para BACKEND_URL e ELDORIA_PUBLIC_HOSTS valerem já nesta configuração.
loadEnvConfig(process.cwd());

// O navegador fala só com este servidor (mesma origem): /api e /socket.io são
// repassados ao backend. Assim o site funciona igual em localhost, por um
// túnel (ex.: Cloudflare) ou de outro aparelho, sem expor a porta do backend.
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3001").replace(/\/$/, "");

// Domínios públicos que abrem o servidor de desenvolvimento (ex.: o do túnel).
const publicHosts = (process.env.ELDORIA_PUBLIC_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

// CSP compatível com o App Router: o Next injeta scripts de hidratação inline
// sem nonce, então 'unsafe-inline' é necessário por enquanto. O ganho está em
// bloquear script/objeto externo e fixar a origem dos recursos.
// Se um dia a API for servida em outro domínio, inclua-o em connect-src.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self' ws: wss:${isDev ? " http: https:" : ""}`,
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: publicHosts,
  poweredByHeader: false,
  // O Socket.IO usa "/socket.io/?EIO=…"; o redirecionamento de barra final o quebraria.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // Rotas próprias do Next (ex.: /api/image-proxy) têm prioridade sobre estas.
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/socket.io", destination: `${backendUrl}/socket.io/` },
      { source: "/socket.io/:path*", destination: `${backendUrl}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
