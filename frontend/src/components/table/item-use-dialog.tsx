"use client";

import { useState } from "react";
import { FlaskConical, HeartPulse, Shield, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HudItem } from "@/lib/table-types";

const EFFECT_ICONS = {
  HEAL: HeartPulse,
  TEMP_HP: Shield,
  DAMAGE: Swords,
} as const;

const EFFECT_LABELS = {
  HEAL: "Cura",
  TEMP_HP: "PV temporário",
  DAMAGE: "Dano",
} as const;

function itemFormula(item: HudItem) {
  if (!item.properties) return null;
  try {
    const data = JSON.parse(item.properties) as Record<string, unknown>;
    const raw = data.healing ?? data.temporaryHp ?? data.tempHp ?? data.damage;
    return typeof raw === "string" || typeof raw === "number" ? String(raw) : null;
  } catch {
    return null;
  }
}

export function ItemUseDialog({
  items,
  characterName,
  busy,
  onOpenChange,
  onUse,
}: {
  items: HudItem[];
  characterName: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (inventoryItemId: string) => Promise<void>;
}) {
  const usable = items.filter((item) => item.quantity > 0 && item.effectKind);
  const [selectedId, setSelectedId] = useState(usable[0]?.inventoryItemId ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const selected =
    usable.find((item) => item.inventoryItemId === selectedId) ?? usable[0] ?? null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setLocalError("Nenhum item utilizável disponível.");
      return;
    }
    setLocalError(null);
    await onUse(selected.inventoryItemId);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-primary" /> Usar item
          </DialogTitle>
          <DialogDescription>
            {characterName} consome o item e o servidor aplica o efeito. A
            quantidade só diminui depois de confirmar.
          </DialogDescription>
        </DialogHeader>

        {usable.length ? (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {usable.map((item) => {
                const Icon = item.effectKind
                  ? EFFECT_ICONS[item.effectKind]
                  : FlaskConical;
                const formula = itemFormula(item);
                return (
                  <label
                    key={item.inventoryItemId}
                    className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                      selected?.inventoryItemId === item.inventoryItemId
                        ? "border-primary/60 bg-primary/8"
                        : "border-border/70 hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="item"
                      className="sr-only"
                      checked={selected?.inventoryItemId === item.inventoryItemId}
                      onChange={() => setSelectedId(item.inventoryItemId)}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.effectKind ? EFFECT_LABELS[item.effectKind] : "Sem efeito"}
                            {formula ? ` · ${formula}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                        x{item.quantity}
                      </Badge>
                    </div>
                    {item.description ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </label>
                );
              })}
            </div>

            <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {selected
                ? `${selected.name} será consumido em ${characterName}.`
                : "Escolha um item."}
            </p>

            {localError ? (
              <p role="alert" className="text-sm text-destructive">
                {localError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || !selected}>
                {busy ? "Aplicando..." : "Usar item"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Nenhum item com efeito utilizável no inventário. Poções com
              `properties.healing` aparecem aqui automaticamente.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
