"use client";

import {
  Flame,
  FlaskConical,
  HeartPulse,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TableActionResult } from "@/lib/table-types";
import { ACTION_LABELS, DAMAGE_TYPE_LABELS } from "@/lib/table-types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

const ICONS = {
  DAMAGE: Swords,
  HEAL: HeartPulse,
  TEMP_HP: Shield,
  CONDITION: Sparkles,
} as const;

const TONES = {
  DAMAGE: "border-[#9d4f52]/35 bg-[#9d4f52]/8 text-[#f0c4c7]",
  HEAL: "border-[#5f8a62]/35 bg-[#5f8a62]/8 text-[#c8e0c2]",
  TEMP_HP: "border-[#5e7e9f]/35 bg-[#5e7e9f]/8 text-[#c6d9ee]",
  CONDITION: "border-[#9b7b49]/35 bg-[#9b7b49]/8 text-[#ead6ae]",
} as const;

const EFFECT_LABELS = {
  DAMAGE: "dano",
  HEAL: "cura",
  TEMP_HP: "PV temporário",
  CONDITION: "condição",
} as const;

function HpBadge({
  hp,
}: {
  hp: { current: number; max: number } | null;
}) {
  return hp ? (
    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
      {hp.current}/{hp.max}
    </Badge>
  ) : null;
}

function SpellCard({
  result,
  compact,
}: {
  result: Extract<TableActionResult, { kind: "CAST_SPELL" }>;
  compact: boolean;
}) {
  const damage = result.damageType !== null;
  const tone = TONES[damage ? "DAMAGE" : "HEAL"];
  const Icon = damage ? Flame : Sparkles;
  const first = result.targets[0] ?? null;
  const after = first?.hpAfter ?? null;
  const slotLabel = result.slot ? `espaço ${result.slot.level}` : "truque";

  return (
    <article
      className={`rounded-xl border p-3 ${tone}`}
      aria-label={`${result.spell.name} em ${result.targets.map((target) => target.name).join(", ")}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {result.spell.name} · {slotLabel}
            </p>
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {result.targets.map((target) => (
                <p key={`${target.kind}:${target.id}`}>
                  {target.name}:{" "}
                  {damage
                    ? `${formatNumber(target.applied)} de dano${
                        target.attack
                          ? ` · ${
                              target.attack.hit
                                ? target.attack.critical
                                  ? "crítico"
                                  : "acertou"
                                : "errou"
                            } (${target.attack.total} vs CA ${target.attack.ac})`
                          : target.save
                            ? ` · ${target.save.success ? "passou" : "falhou"} (${target.save.total} vs CD ${target.save.dc})`
                            : ""
                      }`
                    : `+${formatNumber(target.applied)} PV`}
                </p>
              ))}
              {damage && result.damageType ? (
                <p className="text-[10px] uppercase tracking-wide">
                  {DAMAGE_TYPE_LABELS[result.damageType as keyof typeof DAMAGE_TYPE_LABELS] ??
                    result.damageType}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <HpBadge hp={after} />
      </div>
      {!compact && after ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full bg-current opacity-70"
            style={{
              width: `${Math.max(0, Math.min(100, (after.current / Math.max(after.max, 1)) * 100))}%`,
            }}
          />
        </div>
      ) : null}
    </article>
  );
}

export function ResolutionCard({
  result,
  compact = false,
}: {
  result: TableActionResult;
  compact?: boolean;
}) {
  if (result.kind === "CAST_SPELL") {
    return <SpellCard result={result} compact={compact} />;
  }

  if (result.kind === "CONDITION") {
    return (
      <article
        className={`rounded-xl border p-3 ${TONES.CONDITION}`}
        aria-label={`Condição: ${ACTION_LABELS[result.kind]}`}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-foreground">
              {result.target.name} · {ACTION_LABELS[result.kind]}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {result.conditionsAfter.length
                ? result.conditionsAfter.join(" · ")
                : "Nenhuma condição ativa"}
            </p>
          </div>
        </div>
      </article>
    );
  }

  const effectKind =
    result.kind === "USE_ITEM" ? result.effectKind : result.kind;
  const Icon =
    result.kind === "USE_ITEM" ? FlaskConical : ICONS[result.kind];
  const tone = TONES[effectKind];
  const after = result.hpAfter;
  const title =
    result.kind === "USE_ITEM"
      ? `${result.item.name} · ${result.target.name}`
      : `${result.target.name} · ${ACTION_LABELS[result.kind]}`;
  return (
    <article
      className={`rounded-xl border p-3 ${tone}`}
      aria-label={`${result.kind === "USE_ITEM" ? result.item.name : ACTION_LABELS[result.kind]} em ${result.target.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {effectKind === "HEAL" ? "+" : ""}
              {formatNumber(result.applied)} {EFFECT_LABELS[effectKind]}
              {effectKind === "DAMAGE" && result.damageType
                ? ` · ${DAMAGE_TYPE_LABELS[result.damageType as keyof typeof DAMAGE_TYPE_LABELS] ?? result.damageType}`
                : ""}
              {result.absorbedByTempHp
                ? ` · ${formatNumber(result.absorbedByTempHp)} absorvido por PV temporário`
                : ""}
              {result.kind === "USE_ITEM"
                ? ` · ${result.item.quantityAfter} restante${result.item.quantityAfter === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        </div>
        <HpBadge hp={after} />
      </div>
      {!compact && after ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full bg-current opacity-70"
            style={{
              width: `${Math.max(0, Math.min(100, (after.current / Math.max(after.max, 1)) * 100))}%`,
            }}
          />
        </div>
      ) : null}
    </article>
  );
}
