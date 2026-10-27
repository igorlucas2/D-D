import { NextRequest, NextResponse } from "next/server";

// Repassa imagens externas (mapas/tokens) com cabeçalhos CORS, permitindo
// que o three.js as use como texturas WebGL sem erro de "tainted canvas".
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ message: "Parâmetro 'url' obrigatório." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ message: "URL inválida." }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ message: "Protocolo não suportado." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { headers: { Accept: "image/*" } });
  } catch {
    return NextResponse.json({ message: "Não foi possível buscar a imagem." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ message: "Imagem indisponível." }, { status: upstream.status || 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ message: "Recurso não é uma imagem." }, { status: 415 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
