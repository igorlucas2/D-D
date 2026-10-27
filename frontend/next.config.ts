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

const nextConfig: NextConfig = {
  allowedDevOrigins: publicHosts,
  // O Socket.IO usa "/socket.io/?EIO=…"; o redirecionamento de barra final o quebraria.
  skipTrailingSlashRedirect: true,
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
