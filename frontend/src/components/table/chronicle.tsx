"use client";

import { BookOpen, ChevronDown, ScrollText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ResolutionCard } from "@/components/table/resolution-card";
import type { CombatActionResult } from "@/lib/table-types";

export interface ChronicleEvent {
  eventId: string;
  sequence: number;
  gameMinute: number;
  summary: string;
  narration: string | null;
}

function eventLabel(event: ChronicleEvent) {
  return `#${event.sequence}`;
}

export function Chronicle({
  events,
  actions,
  latestAction,
  sceneName,
  pending,
}: {
  events: ChronicleEvent[];
  actions: CombatActionResult[];
  latestAction: CombatActionResult | null;
  sceneName: string | null;
  pending: boolean;
}) {
  const latest = events[0] ?? null;
  const older = events.slice(1);
  const otherActions = actions.filter(
    (action) => action.actionId !== latestAction?.actionId,
  ).slice(0, 4);

  return (
    <section
      aria-labelledby="chronicle-title"
      aria-busy={pending}
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" aria-hidden="true" />
          <h2
            id="chronicle-title"
            className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-foreground"
          >
            Crônica da mesa
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {pending ? (
            <Badge variant="outline" className="animate-pulse">
              Mestre narrando
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {sceneName ?? "Sem cena"}
            </Badge>
          )}
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        {latest?.narration ? (
          <article aria-live="polite" aria-atomic="true">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="size-3 text-primary" aria-hidden="true" />
              <span>Mestre</span>
              <span aria-hidden="true">·</span>
              <span>#{latest.sequence}</span>
              <span aria-hidden="true">·</span>
              <span>narração do mestre</span>
            </div>
            <p className="mt-4 max-w-[68ch] whitespace-pre-wrap border-l-2 border-primary/25 pl-5 font-narrative text-[1.12rem] leading-8 text-foreground sm:text-[1.22rem] sm:leading-9">
              {latest.narration}
            </p>
          </article>
        ) : (
          <div className="max-w-[60ch]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              A cena espera
            </p>
            <p className="mt-3 font-narrative text-xl leading-8 text-foreground">
              {sceneName
                ? `Você está em ${sceneName}. O que o seu personagem faz?`
                : "A primeira narração do mestre vai aparecer aqui."}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Descreva a ação no composer abaixo. A resposta do mestre será lida
              nesta coluna, como a crônica da sessão.
            </p>
          </div>
        )}

        {latestAction ? (
          <div className="mt-6 max-w-xl">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Resultado aplicado pelo motor
            </p>
            <ResolutionCard result={latestAction} />
          </div>
        ) : null}

        {otherActions.length > 0 ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {otherActions.map((action) => (
              <ResolutionCard key={action.actionId} result={action} compact />
            ))}
          </div>
        ) : null}

        {older.length > 0 ? (
          <details className="group mt-7 border-t border-border/60 pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              Narrações anteriores ({older.length})
              <ScrollText className="ml-auto size-3.5" aria-hidden="true" />
            </summary>
            <ol className="mt-4 flex max-h-80 flex-col gap-4 overflow-y-auto pr-2">
              {older.map((event) => (
                <li key={event.eventId} className="border-l border-border/70 pl-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {eventLabel(event)} · narração anterior
                  </p>
                  <p className="mt-1 whitespace-pre-wrap font-narrative text-sm leading-6 text-foreground/85">
                    {event.narration ?? event.summary}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </section>
  );
}
