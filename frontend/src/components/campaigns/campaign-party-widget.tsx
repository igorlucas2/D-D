"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  FlaskConical,
  HeartPulse,
  Maximize2,
  Minimize2,
  Shield,
  Users,
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
  effectKind: string | null;
}

interface LiveSlot {
  level: number;
  total: number;
  used: number;
}

interface LiveCharacter {
  id: string;
  characterId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;
  conditions: string[];
  conditionTimers?: Array<{ name: string; remainingRounds: number }>;
  concentration: { spellName: string } | null;
  items: LiveItem[];
  spells: LiveSpell[];
  spellSlots: LiveSlot[];
}

interface LiveState {
  characters: LiveCharacter[];
}

type SheetTab = "summary" | "items" | "spells";

function hpTone(value: number): string {
  if (value <= 0.25) return "bg-destructive";
  if (value <= 0.5) return "bg-amber-500";
  return "bg-emerald-500";
}

function healthRatio(character: LiveCharacter): number {
  return Math.max(
    0,
    Math.min(1, character.currentHp / Math.max(character.maxHp, 1)),
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function roundsFor(character: LiveCharacter, condition: string): number | null {
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

function PartyCards({
  characters,
  onSelect,
}: {
  characters: LiveCharacter[];
  onSelect: (character: LiveCharacter) => void;
}) {
  if (!characters.length) {
    return (
      <p className="p-2 text-xs text-muted-foreground">
        Nenhum personagem vinculado. Abra a Mesa para vincular uma ficha.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {characters.map((character) => (
        <button
          key={character.id}
          type="button"
          onClick={() => onSelect(character)}
          className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background/55 p-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/8"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 font-heading text-[10px] text-primary">
            {initials(character.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium">
                {character.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {character.currentHp}/{character.maxHp}
              </span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "block h-full rounded-full",
                  hpTone(healthRatio(character)),
                )}
                style={{ width: `${healthRatio(character) * 100}%` }}
              />
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
              <span>CA {character.armorClass}</span>
              <span>· {spellSummary(character)}</span>
              {character.tempHp > 0 ? (
                <span>· {character.tempHp} temp.</span>
              ) : null}
              {character.conditions.slice(0, 2).map((condition) => {
                const rounds = roundsFor(character, condition);
                return (
                  <span
                    key={condition}
                    className="rounded border border-border/70 px-1"
                  >
                    {condition}
                    {rounds ? ` ${rounds}r` : ""}
                  </span>
                );
              })}
            </span>
          </span>
          <ChevronRight
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

function QuickSheet({
  character,
  tab,
  onTab,
  onMinimize,
  onClose,
}: {
  character: LiveCharacter;
  tab: SheetTab;
  onTab: (tab: SheetTab) => void;
  onMinimize: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label={`Ficha rápida de ${character.name}`}
      className="fixed bottom-0 right-0 top-16 z-50 flex w-full max-w-sm flex-col border-l border-primary/25 bg-card shadow-2xl shadow-black/45 sm:bottom-4 sm:right-4 sm:top-20 sm:rounded-xl sm:border"
    >
      <header className="flex items-start justify-between gap-2 border-b border-border/70 p-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ficha rápida
          </p>
          <h2 className="truncate font-heading text-xl">{character.name}</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Não bloqueia o mapa nem a narração.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onMinimize}
            aria-label="Minimizar ficha"
          >
            <Minimize2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onClose}
            aria-label="Fechar ficha"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-1.5 border-b border-border/70 p-2">
        <div className="rounded-md border border-border/60 bg-background/40 p-2">
          <p className="flex items-center gap-1 text-[9px] uppercase text-muted-foreground">
            <HeartPulse className="size-3" /> PV
          </p>
          <p className="mt-1 font-mono text-xs">
            {character.currentHp}/{character.maxHp}
            {character.tempHp ? ` +${character.tempHp}` : ""}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 p-2">
          <p className="flex items-center gap-1 text-[9px] uppercase text-muted-foreground">
            <Shield className="size-3" /> CA
          </p>
          <p className="mt-1 font-mono text-xs">{character.armorClass}</p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 p-2">
          <p className="text-[9px] uppercase text-muted-foreground">Magia</p>
          <p className="mt-1 font-mono text-xs">
            {spellSummary(character).replace("Magia ", "")}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Ficha rápida"
        className="flex gap-1 border-b border-border/70 p-2"
      >
        {(
          [
            ["summary", "Resumo"],
            ["items", "Itens"],
            ["spells", "Magias"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs",
              tab === id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60",
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
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Condições
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {character.conditions.length ? (
                  character.conditions.map((condition) => {
                    const rounds = roundsFor(character, condition);
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
                    Nenhuma.
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Espaços de magia
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {character.spellSlots.length ? (
                  character.spellSlots.map((slot) => (
                    <Badge
                      key={slot.level}
                      variant="outline"
                      className="font-mono text-[10px]"
                    >
                      Nv {slot.level}: {slot.total - slot.used}/{slot.total}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sem espaços.
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Concentração
              </p>
              <p className="mt-1 text-xs">
                {character.concentration?.spellName ?? "Nenhuma"}
              </p>
            </div>
          </div>
        ) : tab === "items" ? (
          <div className="space-y-1.5">
            {character.items.length ? (
              character.items.map((item) => (
                <div
                  key={item.inventoryItemId}
                  className="flex items-start justify-between gap-2 rounded-md border border-border/60 p-2"
                >
                  <div>
                    <p className="text-sm">{item.name}</p>
                    <p className="text-[9px] uppercase text-muted-foreground">
                      {item.category}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 font-mono text-xs">
                    <FlaskConical className="size-3" />×{item.quantity}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Inventário vazio.</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {character.spells.length ? (
              character.spells.map((spell) => (
                <div
                  key={spell.characterSpellId}
                  className="rounded-md border border-border/60 p-2"
                >
                  <div className="flex justify-between gap-2">
                    <p className="text-sm">{spell.name}</p>
                    <Badge variant="outline" className="text-[9px]">
                      {spell.level === 0 ? "truque" : `Nv ${spell.level}`}
                    </Badge>
                  </div>
                  <p className="text-[9px] uppercase text-muted-foreground">
                    {spell.school}
                    {spell.concentration ? " · concentração" : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma magia.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export function CampaignPartyWidget({
  campaignId,
  mode = "floating",
}: {
  campaignId: string;
  mode?: "floating" | "map";
}) {
  const token = useAuthStore((state) => state.token);
  const [state, setState] = useState<LiveState | null>(null);
  const [open, setOpen] = useState(mode === "map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<SheetTab>("summary");

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
      // Mantém o HUD silencioso; a página continua funcional.
    }
  }, [campaignId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do widget
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const characters = state?.characters ?? [];
  const selected =
    characters.find((character) => character.id === selectedId) ?? null;

  if (!state) return null;

  function select(character: LiveCharacter) {
    setSelectedId(character.id);
    setMinimized(false);
    setTab("summary");
  }

  const sheet = selected ? (
    minimized ? (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-2 text-sm shadow-xl shadow-black/30 hover:bg-primary/10"
      >
        <HeartPulse className="size-4 text-primary" aria-hidden="true" />
        Ficha de {selected.name}
        <Maximize2
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    ) : (
      <QuickSheet
        character={selected}
        tab={tab}
        onTab={setTab}
        onMinimize={() => setMinimized(true)}
        onClose={() => setSelectedId(null)}
      />
    )
  ) : null;

  if (mode === "map") {
    return (
      <>
        <section
          aria-label="Companhia sobre o mapa"
          className="absolute right-2 top-44 z-30 w-[min(15rem,54vw)] overflow-hidden rounded-lg border border-primary/30 bg-card/95 shadow-xl shadow-black/40 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-2 py-1.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Users className="size-3.5" aria-hidden="true" /> Companhia
            </p>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="font-mono text-[9px]">
                {characters.length}
              </Badge>
              <button
                type="button"
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label={
                  open
                    ? "Recolher companhia do mapa"
                    : "Expandir companhia do mapa"
                }
                onClick={() => setOpen((value) => !value)}
              >
                {open ? (
                  <Minimize2 className="size-3" />
                ) : (
                  <Maximize2 className="size-3" />
                )}
              </button>
            </div>
          </div>
          {open ? (
            <div className="max-h-[28dvh] overflow-y-auto p-1.5">
              <PartyCards characters={characters} onSelect={select} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 p-1.5">
              {characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => select(character)}
                  aria-label={`Abrir ficha de ${character.name}`}
                  className="grid size-7 place-items-center rounded-full border border-primary/35 bg-primary/10 font-heading text-[9px] text-primary"
                >
                  {initials(character.name)}
                </button>
              ))}
              {!characters.length ? (
                <span className="px-1 text-[10px] text-muted-foreground">
                  Sem fichas
                </span>
              ) : null}
            </div>
          )}
        </section>
        {sheet}
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2 print:hidden">
        {open ? (
          <div className="w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-primary/30 bg-card shadow-2xl shadow-black/45">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Users className="size-4" aria-hidden="true" /> Companhia
              </p>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {characters.length}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Recolher companhia"
                  onClick={() => setOpen(false)}
                >
                  <Minimize2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="max-h-[45dvh] overflow-y-auto p-1.5">
              <PartyCards characters={characters} onSelect={select} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full border border-primary/35 bg-card px-3 py-2 text-xs shadow-xl shadow-black/35 transition-colors hover:border-primary/55 hover:bg-primary/10"
          >
            <Users className="size-4 text-primary" aria-hidden="true" />
            <span className="font-medium">Companhia</span>
            <span className="flex items-center gap-1">
              {characters.slice(0, 3).map((character) => (
                <span
                  key={character.id}
                  className="flex items-center gap-1 rounded-full border border-border/60 px-1.5 py-0.5 font-mono text-[10px]"
                >
                  <span>{initials(character.name)}</span>
                  <span
                    className={
                      character.currentHp <= character.maxHp * 0.25
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {character.currentHp}
                  </span>
                </span>
              ))}
              {!characters.length ? (
                <span className="text-muted-foreground">0</span>
              ) : null}
            </span>
            <Maximize2
              className="size-3 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      {sheet}
    </>
  );
}
