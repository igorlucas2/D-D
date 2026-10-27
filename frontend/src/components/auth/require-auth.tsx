"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const sessionExpired = useAuthStore((state) => state.sessionExpired);

  // Volta para a mesma página depois de entrar de novo.
  useEffect(() => {
    if (isHydrated && !token) {
      const next = encodeURIComponent(pathname + window.location.search);
      router.replace(`/login?next=${next}${sessionExpired ? "&sessao=expirada" : ""}`);
    }
  }, [isHydrated, token, router, pathname, sessionExpired]);

  if (!isHydrated || !token) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return <>{children}</>;
}
