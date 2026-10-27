"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fallback compartilhado dos `error.tsx`. O Next desta versão expõe
 * `unstable_retry` (revalida e re-renderiza); `reset` só limpa o estado.
 */
export function RouteError({
  error,
  retry,
  title = "Algo saiu do previsto",
  homeHref = "/dashboard",
  homeLabel = "Voltar ao início",
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  title?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-24 text-center"
    >
      <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground">
          Não foi possível carregar esta parte da aplicação. Você pode tentar de
          novo ou voltar para uma tela segura.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            if (retry) retry();
            else window.location.reload();
          }}
        >
          Tentar de novo
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={homeHref} />}
        >
          {homeLabel}
        </Button>
      </div>
      {process.env.NODE_ENV !== "production" ? (
        <p className="max-w-lg text-xs text-muted-foreground">{error.message}</p>
      ) : null}
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Código do erro: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
