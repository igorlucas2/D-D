"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Backpack,
  Coins,
  Palette,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { Character } from "@/lib/types";
import type { HudCharacter, HudItem, HudSpell } from "@/lib/table-types";
import { NoviceSprite } from "./novice-sprite";

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
  jobLevel: number;
  jobExp: number;
  zeny: number;
  gender: string;
  hairStyle: number;
  hairColor: number;
  clothesColor: number;
  skinTone: number;
  classGrantedAt: string | null;
  statPoints: number;
  skillPoints: number;
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

export type RagnarokStat =
  "strength" | "agility" | "vitality" | "intelligence" | "dexterity" | "luck";

export interface RagnarokAppearance {
  gender: string;
  hairStyle: number;
  hairColor: number;
  clothesColor: number;
  skinTone: number;
}

const HAIR_COLORS = [
  "#2b2118",
  "#4a3020",
  "#7a4a2a",
  "#c08a4a",
  "#e0c080",
  "#d8d8d8",
  "#9a3a3a",
  "#4a6a9a",
  "#6a4a8a",
  "#3a6a4a",
];

const CLOTHES_COLORS = [
  "#6b7280",
  "#8b5e3c",
  "#2f6f4e",
  "#2f4f6f",
  "#6f2f4f",
  "#7a5a2f",
  "#4f4f4f",
  "#8f6a6a",
  "#3f5f5f",
  "#5f4f7f",
];

const SKIN_TONES = [
  "#f0c8a0",
  "#d8a878",
  "#b88858",
  "#986848",
  "#704830",
  "#4a3020",
];

type Section =
  "stats" | "appearance" | "skills" | "equipment" | "inventory" | "quests";

interface SkillCatalogEntry {
  id: number;
  name: string;
  maxLevel: number;
  description: string | null;
  parent: string | null;
}

const SECTION_LABEL: Record<Section, string> = {
  stats: "Atributos",
  appearance: "Aparência",
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

function PaperDoll({
  appearance,
  name,
}: {
  appearance: RagnarokAppearance;
  name: string;
}) {
  return (
    <div className="relative h-44 w-28">
      <div
        className="absolute left-1/2 top-0 size-12 -translate-x-1/2 rounded-full border-2"
        style={{
          backgroundColor: SKIN_TONES[appearance.skinTone] ?? SKIN_TONES[0],
          borderColor: HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0],
        }}
      />
      <div
        className="absolute left-1/2 top-0 h-4 w-14 -translate-x-1/2 rounded-t-full"
        style={{
          backgroundColor: HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0],
          height: `${10 + appearance.hairStyle * 1.5}px`,
        }}
      />
      <div
        className="absolute left-1/2 top-11 h-20 w-16 -translate-x-1/2 rounded-t-[2rem] border"
        style={{
          backgroundColor:
            CLOTHES_COLORS[appearance.clothesColor] ?? CLOTHES_COLORS[0],
          borderColor: HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0],
        }}
      />
      <div
        className="absolute left-1 top-12 h-16 w-3 rotate-6 rounded-full border"
        style={{
          backgroundColor:
            CLOTHES_COLORS[appearance.clothesColor] ?? CLOTHES_COLORS[0],
          borderColor: HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0],
        }}
      />
      <div
        className="absolute right-1 top-12 h-16 w-3 -rotate-6 rounded-full border"
        style={{
          backgroundColor:
            CLOTHES_COLORS[appearance.clothesColor] ?? CLOTHES_COLORS[0],
          borderColor: HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0],
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-16 w-5 -translate-x-7 rounded-b-full border"
        style={{
          backgroundColor:
            CLOTHES_COLORS[appearance.clothesColor] ?? CLOTHES_COLORS[0],
          borderColor: HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0],
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-16 w-5 translate-x-2 rounded-b-full border"
        style={{
          backgroundColor:
            CLOTHES_COLORS[appearance.clothesColor] ?? CLOTHES_COLORS[0],
          borderColor: HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0],
        }}
      />
      <div className="absolute inset-x-0 bottom-5 text-center font-heading text-2xl text-primary/80">
        {initials(name)}
      </div>
    </div>
  );
}

export function CharacterScreen({
  open,
  onClose,
  srd,
  hud,
  ragnarok,
  onAllocateStat,
  allocating = false,
  onLearnSkill,
  learning = false,
  bound = false,
  onBind,
  binding = false,
  onSaveAppearance,
  savingAppearance = false,
}: {
  open: boolean;
  onClose: () => void;
  onAllocateStat?: (stat: RagnarokStat) => Promise<void> | void;
  allocating?: boolean;
  onLearnSkill?: (skillId: number, level: number) => Promise<void> | void;
  learning?: boolean;
  bound?: boolean;
  onBind?: () => Promise<void> | void;
  binding?: boolean;
  onSaveAppearance?: (appearance: RagnarokAppearance) => Promise<void> | void;
  savingAppearance?: boolean;
  srd: Character | null;
  hud: HudCharacter | null;
  ragnarok: RagnarokSheet | null;
}) {
  const token = useAuthStore((state) => state.token);
  const [activeSection, setActiveSection] = useState<Section>("stats");
  const [appearance, setAppearance] = useState<RagnarokAppearance>({
    gender: "M",
    hairStyle: 1,
    hairColor: 0,
    clothesColor: 0,
    skinTone: 0,
  });
  const [skillQuery, setSkillQuery] = useState("");
  const [skillResults, setSkillResults] = useState<SkillCatalogEntry[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const appearanceSheetId = useRef<string | null>(null);

  useEffect(() => {
    if (!ragnarok) return;
    if (appearanceSheetId.current === ragnarok.id) return;
    appearanceSheetId.current = ragnarok.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza a ficha carregada
    setAppearance({
      gender: ragnarok.gender ?? "M",
      hairStyle: ragnarok.hairStyle ?? 1,
      hairColor: ragnarok.hairColor ?? 0,
      clothesColor: ragnarok.clothesColor ?? 0,
      skinTone: ragnarok.skinTone ?? 0,
    });
  }, [ragnarok]);

  useEffect(() => {
    if (!open || !token || !ragnarok) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSkillLoading(true);
      try {
        const query = skillQuery.trim();
        const result = await api.get<SkillCatalogEntry[]>(
          `/ragnarok/skills?take=20${
            query.length >= 2 ? `&search=${encodeURIComponent(query)}` : ""
          }`,
          token,
        );
        if (!cancelled) setSkillResults(result);
      } catch {
        if (!cancelled) setSkillResults([]);
      } finally {
        if (!cancelled) setSkillLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, ragnarok, skillQuery, token]);
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
  const jobNext = ragnarok ? 100 + Math.max(0, ragnarok.jobLevel - 1) * 50 : 0;
  const knownSkills = new Map(
    (ragnarok?.skills ?? []).map((entry) => [entry.skill.id, entry.level]),
  );

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
            {ragnarok ? ` · ${ragnarok.job.jt} · Job ${ragnarok.jobLevel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ragnarok ? (
            bound ? (
              <Badge variant="default" className="text-[10px]">
                Vinculada à campanha
              </Badge>
            ) : onBind ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={binding}
                onClick={() => void onBind()}
              >
                {binding ? "Vinculando..." : "Vincular à campanha"}
              </Button>
            ) : null
          ) : null}
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Coins className="size-3.5" /> Zeny{" "}
            {ragnarok ? ragnarok.zeny.toLocaleString("pt-BR") : "—"}
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
              {ragnarok?.job.id === 0 ? (
                <NoviceSprite
                  gender={appearance.gender}
                  hairStyle={appearance.hairStyle}
                  fallback={<PaperDoll appearance={appearance} name={name} />}
                />
              ) : (
                <PaperDoll appearance={appearance} name={name} />
              )}
              <p className="mt-3 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {ragnarok?.job.id === 0
                  ? "Sprite local · Aprendiz"
                  : "Paper doll"}
              </p>
              <p className="mt-1 font-heading text-lg">{name}</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {className}
              </p>
              {ragnarok ? (
                <div className="mt-3 w-40">
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Job {ragnarok.jobLevel}</span>
                    <span className="font-mono">
                      {ragnarok.jobExp}/{jobNext}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, (ragnarok.jobExp / Math.max(1, jobNext)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
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
                ) : section === "appearance" ? (
                  <Palette className="size-3.5" />
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
                  Base, equipamento e progressão.
                  {ragnarok
                    ? ` Pontos disponíveis: ${ragnarok.statPoints}.`
                    : " Ficha SRD em modo somente leitura."}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ragnarok
                    ? (
                        [
                          ["FOR", ragnarok.strength, "strength"],
                          ["AGI", ragnarok.agility, "agility"],
                          ["VIT", ragnarok.vitality, "vitality"],
                          ["INT", ragnarok.intelligence, "intelligence"],
                          ["DES", ragnarok.dexterity, "dexterity"],
                          ["SOR", ragnarok.luck, "luck"],
                        ] as const
                      ).map(([label, value, stat]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-border/50 bg-background/40 p-2"
                        >
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {label}
                          </p>
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-mono text-xl">{value}</p>
                            {onAllocateStat && ragnarok.statPoints > 0 ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-primary"
                                aria-label={`Aumentar ${label}`}
                                disabled={allocating}
                                onClick={() => void onAllocateStat(stat)}
                              >
                                +
                              </Button>
                            ) : null}
                          </div>
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
                data-character-panel="appearance"
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <h2 className="font-heading text-lg">Aparência</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cabelo, cor, roupa e pele. A prévia é provisória; o renderer
                  local de sprites entra na próxima camada.
                </p>
                {ragnarok ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-5">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">
                        Gênero
                      </label>
                      <select
                        value={appearance.gender}
                        onChange={(event) =>
                          setAppearance((current) => ({
                            ...current,
                            gender: event.target.value,
                          }))
                        }
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">
                        Corte
                      </label>
                      <select
                        value={appearance.hairStyle}
                        onChange={(event) =>
                          setAppearance((current) => ({
                            ...current,
                            hairStyle: Number(event.target.value),
                          }))
                        }
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {Array.from(
                          { length: 10 },
                          (_, index) => index + 1,
                        ).map((style) => (
                          <option key={style} value={style}>
                            Estilo {style}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">
                        Cabelo
                      </label>
                      <select
                        value={appearance.hairColor}
                        onChange={(event) =>
                          setAppearance((current) => ({
                            ...current,
                            hairColor: Number(event.target.value),
                          }))
                        }
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {Array.from({ length: 10 }, (_, index) => index).map(
                          (color) => (
                            <option key={color} value={color}>
                              Tom {color}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">
                        Roupa
                      </label>
                      <select
                        value={appearance.clothesColor}
                        onChange={(event) =>
                          setAppearance((current) => ({
                            ...current,
                            clothesColor: Number(event.target.value),
                          }))
                        }
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {Array.from({ length: 10 }, (_, index) => index).map(
                          (color) => (
                            <option key={color} value={color}>
                              Tom {color}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">
                        Pele
                      </label>
                      <select
                        value={appearance.skinTone}
                        onChange={(event) =>
                          setAppearance((current) => ({
                            ...current,
                            skinTone: Number(event.target.value),
                          }))
                        }
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {Array.from({ length: 6 }, (_, index) => index).map(
                          (tone) => (
                            <option key={tone} value={tone}>
                              Tom {tone}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <Button
                        size="sm"
                        disabled={!onSaveAppearance || savingAppearance}
                        onClick={() => void onSaveAppearance?.(appearance)}
                      >
                        {savingAppearance ? "Salvando..." : "Salvar aparência"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Aparência disponível apenas para ficha Ragnarok.
                  </p>
                )}
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
                    Pontos {ragnarok?.skillPoints ?? 0}
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

                {ragnarok && onLearnSkill ? (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-2">
                      <Search className="size-4 text-muted-foreground" />
                      <Input
                        value={skillQuery}
                        onChange={(event) => setSkillQuery(event.target.value)}
                        placeholder="Buscar skill para aprender…"
                        className="h-8 text-xs"
                        aria-label="Buscar skill"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {skillQuery.trim().length >= 2
                        ? "Resultados da busca."
                        : "Primeiras skills do catálogo; digite 2+ letras para filtrar."}
                      {skillLoading ? " Carregando…" : ""}
                    </p>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {skillResults.map((skill) => {
                        const currentLevel = knownSkills.get(skill.id) ?? 0;
                        const canLearn =
                          ragnarok.skillPoints > 0 &&
                          currentLevel < skill.maxLevel &&
                          !learning;
                        return (
                          <div
                            key={skill.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/35 px-2 py-1.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs">{skill.name}</p>
                              <p className="font-mono text-[9px] text-muted-foreground">
                                {currentLevel}/{skill.maxLevel}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 shrink-0 px-2 text-[10px]"
                              disabled={!canLearn}
                              onClick={() =>
                                void onLearnSkill(skill.id, currentLevel + 1)
                              }
                            >
                              Aprender
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
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
