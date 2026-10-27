"use client";
import { useEffect, useState } from "react";

const protectedMap = /^\/api\/campaigns\/[^/]+\/lore\/maps\/[^/]+\/image$/;
// Bearer-authenticated assets become local blob URLs for CSS, Image and WebGL.
export function useLoreMapImage(
  url: string | null | undefined,
  token: string | null,
) {
  const [loaded, setLoaded] = useState<{
    url: string;
    token: string;
    blob: string | null;
  } | null>(null);
  const needsAuth = !!url && protectedMap.test(url);
  useEffect(() => {
    if (!url || !needsAuth || !token) return;
    const controller = new AbortController();
    let blob: string | null = null;
    let active = true;
    const path =
      (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/$/, "") +
      url.slice(4);
    fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Imagem indisponível");
        return response.blob();
      })
      .then((data) => {
        if (active) {
          blob = URL.createObjectURL(data);
          setLoaded({ url, token, blob });
        }
      })
      .catch(() => {
        if (active) setLoaded({ url, token, blob: null });
      });
    return () => {
      active = false;
      controller.abort();
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [url, token, needsAuth]);
  return needsAuth
    ? loaded?.url === url && loaded.token === token
      ? loaded.blob
      : null
    : (url ?? null);
}
