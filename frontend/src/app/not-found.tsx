"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 py-24 text-center">
      <Compass className="size-10 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold">
          Página não encontrada
        </h1>
        <p className="text-muted-foreground">
          O caminho que você tentou abrir não existe ou foi movido.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Ir para o painel
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/campaigns" />}
        >
          Ver campanhas
        </Button>
      </div>
    </div>
  );
}
