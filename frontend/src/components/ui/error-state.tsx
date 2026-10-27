"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Falha de carregamento dentro de uma tela já montada (não é boundary de
 * rota). Mostra o motivo e oferece nova tentativa sem recarregar a página.
 */
export function ErrorState({
  title = "Não foi possível carregar",
  message,
  onRetry,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {message ?? "Tente novamente em instantes."}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}
