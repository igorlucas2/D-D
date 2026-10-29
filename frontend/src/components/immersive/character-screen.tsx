"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Backpack,
  Coins,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Character } from "@/lib/types";
import type { HudCharacter, HudItem, HudSpell } from "@/lib/table-types";

export interface RagnarokSheet {
  id: string;
  name: string;
  level: number;
  job: { id: number; name: string; jt: string };
  strength: number;
  agility: number;
  vitality: number;
  intelligence: number;
  dexterity: number;
  luck: number;
  appearance: string | null;
  maxHp: number;
  currentHp: number;
  maxSp: number;
  currentSp: number;
  skills: Array<{
    id: string;
    level: number;
    skill: { id: number; name: string; maxLevel: number };
  }>;
  equipment: Array<{
    id: string;
    slot: string | null;
    equipped: boolean;
    item: { id: number; name: string };
  }>;
}

type Section = "stats" | "skills" | "equipment" | "inventory" | "quests";

const SECTION_LABEL: Record<Section, string> = {
  stats: "Atributos",
  skills: "Habilidades",
  equipment: "Equipamento",
  inventory: "Inventário",
  quests: "Missões",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ItemRow({ item }: { item: HudItem }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{item.name}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {item.category}
        </p>
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        x{item.quantity}
      </span>
    </div>
  );
}

function SpellRow({ spell }: { spell: HudSpell }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/45 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm">{spell.name}</p>
        <Badge variant="outline" className="font-mono text-[10px]">
          {spell.level === 0 ? "Truque" : `Nv ${spell.level}`}
        </Badge>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {spell.school} · {spell.actionType}
        {spell.concentration ? " · concentração" : ""}
      </p>
    </div>
  );
}

export function CharacterScreen({
  open,
  onClose,
  srd,
  hud,
  ragnarok,
}: {
  open: boolean;
  onClose: () => void;
  srd: Character | null;
  hud: HudCharacter | null;
  ragnarok: RagnarokSheet | null;
}) {
  const [activeSection, setActiveSection] = useState<Section>("stats");
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  const name = ragnarok?.name ?? srd?.name ?? "Aventureiro";
  const level = ragnarok?.level ?? srd?.level ?? 1;
  const className = ragnarok?.job.name ?? srd?.class ?? "Sem classe";
  const hp = ragnarok
    ? `${ragnarok.currentHp}/${ragnarok.maxHp}`
    : hud
      ? `${hud.currentHp}/${hud.maxHp}`
      : "—";
  const sp = ragnarok ? `${ragnarok.currentSp}/${ragnarok.maxSp}` : "—";

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[#0b0d0b]/97 text-foreground backdrop-blur-md"
      role="dialog"
      aria-label="Tela de personagem"
      aria-modal="true"
    >
      <header className="flex items-center justify-between gap-4 border-b border-primary/25 px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
            Ficha de Eldoria
          </p>
          <h1 className="font-heading text-2xl">{name}</h1>
          <p className="text-xs text-muted-foreground">
            {className} · Nv {level}
            {ragnarok ? ` · ${ragnarok.job.jt}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Coins className="size-3.5" /> Zeny —
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar ficha"
          >
            <X className="size-5" />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-border/60 bg-background/35 p-4 lg:flex">
          <div className="relative flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-[radial-gradient(circle_at_50%_35%,rgba(201,162,94,0.18),transparent_55%),linear-gradient(160deg,#181b18,#0c0e0c)]">
            <div className="absolute bottom-8 h-16 w-40 rounded-[50%] bg-black/50 blur-2xl" />
            <div className="relative flex flex-col items-center">
              <div className="relative h-44 w-28">
                <div className="absolute left-1/2 top-0 size-12 -translate-x-1/2 rounded-full border border-primary/50 bg-[#1e211c]" />
                <div className="absolute left-1/2 top-11 h-20 w-16 -translate-x-1/2 rounded-t-[2rem] border border-primary/40 bg-[#1a1d19]" />
                <div className="absolute left-1 top-12 h-16 w-3 rotate-6 rounded-full border border-primary/30 bg-[#1a1d19]" />
                <div className="absolute right-1 top-12 h-16 w-3 -rotate-6 rounded-full border border-primary/30 bg-[#1a1d19]" />
                <div className="absolute bottom-0 left-1/2 h-16 w-5 -translate-x-7 rounded-b-full border border-primary/30 bg-[#1a1d19]" />
                <div className="absolute bottom-0 left-1/2 h-16 w-5 translate-x-2 rounded-b-full border border-primary/30 bg-[#1a1d19]" />
                <div className="absolute inset-x-0 bottom-5 text-center font-heading text-2xl text-primary/80">
                  {initials(name)}
                </div>
              </div>
              <p className="mt-3 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Paper doll
              </p>
              <p className="mt-1 font-heading text-lg">{name}</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {className}
              </p>
            </div>
            <div className="absolute inset-x-3 bottom-3 flex justify-between text-[10px] text-muted-foreground">
              <span>PV {hp}</span>
              <span>SP {sp}</span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Equipado
            </p>
            {ragnarok?.equipment.length ? (
              ragnarok.equipment.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5 text-xs"
                >
                  <span className="truncate">{entry.item.name}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {entry.slot ?? "—"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Nada equipado.</p>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 p-2">
            {(Object.keys(SECTION_LABEL) as Section[]).map((section) => (
              <Button
                key={section}
                size="sm"
                variant={section === activeSection ? "default" : "ghost"}
                className="shrink-0 gap-1.5"
                data-character-section={section}
                onClick={() => {
                  setActiveSection(section);
                  const element = document.querySelector(
                    `[data-character-panel="${section}"]`,
                  );
                  element?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                {section === "stats" ? (
                  <Shield className="size-3.5" />
                ) : section === "skills" ? (
                  <Sparkles className="size-3.5" />
                ) : section === "equipment" ? (
                  <Swords className="size-3.5" />
                ) : section === "inventory" ? (
                  <Backpack className="size-3.5" />
                ) : (
                  <ScrollText className="size-3.5" />
                )}
                {SECTION_LABEL[section]}
              </Button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto grid w-full max-w-4xl gap-4 pb-10">
              <section
                data-character-panel="stats"
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <h2 className="font-heading text-lg">Atributos</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Base, equipamento e progressão. Os pontos ainda não são
                  distribuíveis neste modo.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ragnarok
                    ? (
                        [
                          ["FOR", ragnarok.strength],
                          ["AGI", ragnarok.agility],
                          ["VIT", ragnarok.vitality],
                          ["INT", ragnarok.intelligence],
                          ["DES", ragnarok.dexterity],
                          ["SOR", ragnarok.luck],
                        ] as const
                      ).map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-border/50 bg-background/40 p-2"
                        >
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {label}
                          </p>
                          <p className="font-mono text-xl">{value}</p>
                        </div>
                      ))
                    : (
                        [
                          ["FOR", srd?.strength],
                          ["DES", srd?.dexterity],
                          ["CON", srd?.constitution],
                          ["INT", srd?.intelligence],
                          ["SAB", srd?.wisdom],
                          ["CAR", srd?.charisma],
                        ] as const
                      ).map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-border/50 bg-background/40 p-2"
                        >
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {label}
                          </p>
                          <p className="font-mono text-xl">{value ?? "—"}</p>
                        </div>
                      ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                    <p className="text-[10px] text-muted-foreground">PV</p>
                    <p className="font-mono text-sm">{hp}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                    <p className="text-[10px] text-muted-foreground">SP</p>
                    <p className="font-mono text-sm">{sp}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                    <p className="text-[10px] text-muted-foreground">CA</p>
                    <p className="font-mono text-sm">
                      {ragnarok
                        ? "—"
                        : (hud?.armorClass ?? srd?.armorClass ?? "—")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                    <p className="text-[10px] text-muted-foreground">
                      Deslocamento
                    </p>
                    <p className="font-mono text-sm">
                      {ragnarok ? "—" : `${srd?.speed ?? "—"} pés`}
                    </p>
                  </div>
                </div>
              </section>

              <section
                data-character-panel="skills"
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg">Habilidades</h2>
                    <p className="text-xs text-muted-foreground">
                      {ragnarok
                        ? "Skills Ragnarok aprendidas."
                        : "Magias preparadas na ficha SRD."}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Pontos 0
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ragnarok?.skills.length ? (
                    ragnarok.skills.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-border/60 bg-background/45 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm">
                            {entry.skill.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {entry.level}/{entry.skill.maxLevel}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : hud?.spells.length ? (
                    hud.spells.map((spell) => (
                      <SpellRow key={spell.characterSpellId} spell={spell} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma habilidade aprendida.
                    </p>
                  )}
                </div>
              </section>

              <section
                data-character-panel="equipment"
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <h2 className="font-heading text-lg">Equipamento</h2>
                <p className="text-xs text-muted-foreground">
                  Armas, armaduras e acessórios.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ragnarok?.equipment.length ? (
                    ragnarok.equipment.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2"
                      >
                        <span className="truncate text-sm">
                          {entry.item.name}
                        </span>
                        <Badge
                          variant={entry.equipped ? "default" : "outline"}
                          className="text-[9px]"
                        >
                          {entry.slot ?? "Geral"}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sem equipamento Ragnarok registrado.
                    </p>
                  )}
                </div>
              </section>

              <section
                data-character-panel="inventory"
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <h2 className="font-heading text-lg">Inventário</h2>
                <p className="text-xs text-muted-foreground">
                  Itens disponíveis para uso em combate.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {hud?.items.length ? (
                    hud.items.map((item) => (
                      <ItemRow key={item.inventoryItemId} item={item} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Inventário vazio.
                    </p>
                  )}
                </div>
              </section>

              <section
                data-character-panel="quests"
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <h2 className="font-heading text-lg">Missões</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nenhuma missão ativa. O diário e o construtor de missões do
                  mestre entram na próxima fase.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
