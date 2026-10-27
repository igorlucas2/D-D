"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const [hydrationTimedOut, setHydrationTimedOut] = useState(false);

  // Storage ilegível não pode deixar a tela em "Carregando..." para sempre.
  useEffect(() => {
    if (isHydrated) return;
    const timer = window.setTimeout(() => setHydrationTimedOut(true), 2_000);
    return () => window.clearTimeout(timer);
  }, [isHydrated]);

  const ready = isHydrated || hydrationTimedOut;

  // Volta para a mesma página depois de entrar de novo.
  useEffect(() => {
    if (ready && !token) {
      const next = encodeURIComponent(pathname + window.location.search);
      router.replace(`/login?next=${next}${sessionExpired ? "&sessao=expirada" : ""}`);
    }
  }, [ready, token, router, pathname, sessionExpired]);

  if (!ready || !token) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return <>{children}</>;
}
