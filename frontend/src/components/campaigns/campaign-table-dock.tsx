"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  FlaskConical,
  HeartPulse,
  Maximize2,
  Minimize2,
  Shield,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

interface LiveItem {
  inventoryItemId: string;
  name: string;
  quantity: number;
  category: string;
  effectKind: string | null;
}

interface LiveSpell {
  characterSpellId: string;
  name: string;
  level: number;
  school: string;
  concentration: boolean;
  effectKind: string;
}

interface LiveSlot {
  level: number;
  total: number;
  used: number;
}

interface LiveConcentration {
  spellName: string;
  targetName?: string;
  targets?: Array<{ name: string }>;
}

interface LiveCharacter {
  id: string;
  characterId: string;
  name: string;
  isMine: boolean;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;
  conditions: string[];
  conditionTimers?: Array<{ name: string; remainingRounds: number }>;
  concentration: LiveConcentration | null;
  items: LiveItem[];
  spells: LiveSpell[];
  spellSlots: LiveSlot[];
}

interface LiveEvent {
  eventId: string;
  sequence: number;
  summary: string;
  narration?: string | null;
}

interface LiveState {
  characters: LiveCharacter[];
  events: LiveEvent[];
}

function hpTone(ratio: number): string {
  if (ratio <= 0.25) return "bg-destructive";
  if (ratio <= 0.5) return "bg-amber-500";
  return "bg-emerald-500";
}

function healthRatio(character: LiveCharacter): number {
  return Math.max(
    0,
    Math.min(1, character.currentHp / Math.max(character.maxHp, 1)),
  );
}

function characterInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function timerFor(character: LiveCharacter, condition: string): number | null {
  return (
    character.conditionTimers?.find(
      (timer) => timer.name.toLowerCase() === condition.toLowerCase(),
    )?.remainingRounds ?? null
  );
}

function spellSummary(character: LiveCharacter): string {
  const available = character.spellSlots.reduce(
    (sum, slot) => sum + Math.max(0, slot.total - slot.used),
    0,
  );
  const total = character.spellSlots.reduce((sum, slot) => sum + slot.total, 0);
  return total > 0 ? `Magia ${available}/${total}` : "Sem magia";
}

export function CampaignTableDock({
  campaignId,
  showParty = true,
}: {
  campaignId: string;
  showParty?: boolean;
}) {
  const token = useAuthStore((state) => state.token);
  const [state, setState] = useState<LiveState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<"summary" | "items" | "spells">("summary");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const next = await api.get<LiveState>(
        `/campaigns/${campaignId}/ai-master/state`,
        token,
      );
      setState(next);
      setSelectedId((current) =>
        current && next.characters.some((item) => item.id === current)
          ? current
          : null,
      );
    } catch {
      // A mesa continua utilizável; o dock apenas fica vazio.
    }
  }, [campaignId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do dock
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const characters = state?.characters ?? [];
  const latest = state?.events?.[0] ?? null;
  const selected =
    characters.find((character) => character.id === selectedId) ?? null;

  if (!state) return null;

  return (
    <>
      <section
        className={cn(
          "min-w-0 gap-3",
          showParty
            ? "grid lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"
            : "block",
        )}
      >
        <article className="relative overflow-hidden rounded-xl border border-primary/25 bg-card/90 p-4 shadow-md shadow-black/15">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 -top-16 size-48 rounded-full bg-primary/8 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                <BookOpen className="size-3.5" aria-hidden="true" /> Crônica
                pública
              </p>
              <h2 className="mt-1 font-heading text-xl text-foreground">
                {latest ? `Cena #${latest.sequence}` : "A aventura começa"}
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1 text-[11px]"
              nativeButton={false}
              render={<Link href={`/campaigns/${campaignId}/play`} />}
            >
              Mesa narrada{" "}
              <ChevronRight className="size-3" aria-hidden="true" />
            </Button>
          </div>
          <p className="relative mt-3 line-clamp-5 whitespace-pre-line font-narrative text-base leading-7 text-foreground/90">
            {latest?.narration?.trim() ||
              latest?.summary ||
              "Abra a mesa narrada para iniciar a crônica. Tudo o que for narrado ali é público para os jogadores."}
          </p>
          <p className="relative mt-3 text-[11px] text-muted-foreground">
            Visível para todos os jogadores da campanha. Regras, dados e PV são
            aplicados pelo motor.
          </p>
        </article>

        {showParty ? (
          <article className="rounded-xl border border-border/70 bg-card/85 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Companhia
                </p>
                <h2 className="mt-1 font-heading text-xl">Quem está na mesa</h2>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {characters.length}
              </Badge>
            </div>
            {characters.length ? (
              <div className="mt-3 grid gap-2">
                {characters.map((character) => {
                  const ratio = healthRatio(character);
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(character.id);
                        setMinimized(false);
                        setTab("summary");
                      }}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background/45 p-2.5 text-left transition-colors hover:border-primary/45 hover:bg-primary/5",
                        selectedId === character.id &&
                          "border-primary/55 bg-primary/8",
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 font-heading text-xs text-primary">
                        {characterInitials(character.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {character.name}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {character.currentHp}/{character.maxHp}
                          </span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full transition-all",
                              hpTone(ratio),
                            )}
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                          <span>CA {character.armorClass}</span>
                          <span>· {spellSummary(character)}</span>
                          {character.tempHp > 0 ? (
                            <span>· {character.tempHp} temp.</span>
                          ) : null}
                          {character.conditions.slice(0, 2).map((condition) => {
                            const rounds = timerFor(character, condition);
                            return (
                              <span
                                key={condition}
                                className="rounded border border-border/70 px-1 py-0.5"
                              >
                                {condition}
                                {rounds ? ` ${rounds}r` : ""}
                              </span>
                            );
                          })}
                        </span>
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
                Nenhum personagem vinculado ainda. Cada jogador deve criar a
                ficha e vinculá-la na cena do grupo.
              </div>
            )}
          </article>
        ) : null}
      </section>

      {selected ? (
        minimized ? (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-2 text-sm shadow-xl shadow-black/30 transition-colors hover:bg-primary/10"
          >
            <HeartPulse className="size-4 text-primary" aria-hidden="true" />
            Ficha de {selected.name}
            <Maximize2
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        ) : (
          <aside
            aria-label={`Ficha rápida de ${selected.name}`}
            className="fixed bottom-0 right-0 top-16 z-50 flex w-full max-w-md flex-col border-l border-primary/25 bg-card shadow-2xl shadow-black/40 sm:bottom-4 sm:right-4 sm:top-20 sm:rounded-xl sm:border"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border/70 p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Ficha rápida
                </p>
                <h2 className="truncate font-heading text-2xl">
                  {selected.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Não bloqueia o mapa nem a narração.
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setMinimized(true)}
                  aria-label="Minimizar ficha"
                >
                  <Minimize2 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setSelectedId(null)}
                  aria-label="Fechar ficha"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-2 border-b border-border/70 p-3">
              <div className="rounded-lg border border-border/60 bg-background/40 p-2">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <HeartPulse className="size-3" /> PV
                </p>
                <p className="mt-1 font-mono text-sm">
                  {selected.currentHp}/{selected.maxHp}
                  {selected.tempHp ? ` +${selected.tempHp}` : ""}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-2">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Shield className="size-3" /> CA
                </p>
                <p className="mt-1 font-mono text-sm">{selected.armorClass}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Concentração
                </p>
                <p
                  className="mt-1 truncate text-xs"
                  title={selected.concentration?.spellName ?? ""}
                >
                  {selected.concentration?.spellName ?? "—"}
                </p>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Seções da ficha rápida"
              className="flex gap-1 border-b border-border/70 p-2"
            >
              {(
                [
                  ["summary", "Resumo"],
                  ["items", `Itens ${selected.items.length}`],
                  ["spells", `Magias ${selected.spells.length}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                    tab === id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {tab === "summary" ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Condições
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selected.conditions.length ? (
                        selected.conditions.map((condition) => {
                          const rounds = timerFor(selected, condition);
                          return (
                            <Badge
                              key={condition}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {condition}
                              {rounds ? ` · ${rounds}r` : ""}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Nenhuma condição ativa.
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Espaços de magia
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selected.spellSlots.length ? (
                        selected.spellSlots.map((slot) => (
                          <Badge
                            key={slot.level}
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            Nv {slot.level}: {slot.total - slot.used}/
                            {slot.total}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sem espaços.
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/characters/${selected.characterId}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 px-3 text-sm text-primary hover:bg-primary/10"
                  >
                    Abrir ficha completa{" "}
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              ) : tab === "items" ? (
                <div className="space-y-2">
                  {selected.items.length ? (
                    selected.items.map((item) => (
                      <div
                        key={item.inventoryItemId}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {item.category}
                            {item.effectKind
                              ? ` · ${item.effectKind.toLowerCase()}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <FlaskConical
                            className="size-3 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="font-mono text-xs">
                            ×{item.quantity}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Inventário vazio.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {selected.spells.length ? (
                    selected.spells.map((spell) => (
                      <div
                        key={spell.characterSpellId}
                        className="rounded-lg border border-border/60 bg-background/40 p-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{spell.name}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {spell.level === 0 ? "truque" : `Nv ${spell.level}`}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {spell.school}
                          {spell.concentration ? " · concentração" : ""} ·{" "}
                          {spell.effectKind.toLowerCase()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma magia conhecida.
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        )
      ) : null}
    </>
  );
}
