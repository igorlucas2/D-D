"use client";

import { HeartPulse, Shield, Sparkles, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CombatActionResult } from "@/lib/table-types";
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

export function ResolutionCard({
  result,
  compact = false,
}: {
  result: CombatActionResult;
  compact?: boolean;
}) {
  const Icon = ICONS[result.kind];
  const tone = TONES[result.kind];

  if (result.kind === "CONDITION") {
    return (
      <article
        className={`rounded-xl border p-3 ${tone}`}
        aria-label={`Condição: ${ACTION_LABELS[result.kind]}`}
      >
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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

  const after = result.hpAfter;
  return (
    <article
      className={`rounded-xl border p-3 ${tone}`}
      aria-label={`${ACTION_LABELS[result.kind]} em ${result.target.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {result.target.name} · {ACTION_LABELS[result.kind]}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {result.kind === "HEAL" ? "+" : ""}
              {formatNumber(result.applied)}
              {result.kind === "DAMAGE" && result.damageType
                ? ` ${DAMAGE_TYPE_LABELS[result.damageType as keyof typeof DAMAGE_TYPE_LABELS] ?? result.damageType}`
                : ""}
              {result.absorbedByTempHp
                ? ` · ${formatNumber(result.absorbedByTempHp)} absorvido por PV temporário`
                : ""}
            </p>
          </div>
        </div>
        {after ? (
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
            {after.current}/{after.max}
          </Badge>
        ) : null}
      </div>
      {!compact && after ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full bg-current opacity-70"
            style={{ width: `${Math.max(0, Math.min(100, (after.current / Math.max(after.max, 1)) * 100))}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}
