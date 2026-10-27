"use client";

import { useMemo, useState } from "react";
import { Swords } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import type { ActionTarget, HudCharacter, HudItem } from "@/lib/table-types";

export interface WeaponAttackInput {
  inventoryItemId: string;
  targetKind: "CHARACTER" | "PARTICIPANT";
  targetId: string;
}

function weaponDamage(item: HudItem): string {
  if (!item.properties) return "dano não informado";
  try {
    const data = JSON.parse(item.properties) as Record<string, unknown>;
    const damage = typeof data.damage === "string" ? data.damage : null;
    const type = typeof data.damageType === "string" ? data.damageType : null;
    return [damage, type].filter(Boolean).join(" · ") || "dano não informado";
  } catch {
    return "dano não informado";
  }
}

export function WeaponAttackDialog({
  character,
  targets,
  busy,
  onOpenChange,
  onAttack,
}: {
  character: HudCharacter;
  targets: ActionTarget[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onAttack: (input: WeaponAttackInput) => Promise<void>;
}) {
  const weapons = useMemo(
    () => character.items.filter((item) => item.category === "Arma"),
    [character.items],
  );
  const [weaponId, setWeaponId] = useState(weapons[0]?.inventoryItemId ?? "");
  const initialTarget =
    targets.find((target) => target.characterId !== character.characterId) ??
    targets[0] ??
    null;
  const [targetKey, setTargetKey] = useState(
    initialTarget ? `${initialTarget.kind}:${initialTarget.id}` : "",
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const weapon =
    weapons.find((item) => item.inventoryItemId === weaponId) ?? weapons[0] ?? null;
  const target =
    targets.find((item) => `${item.kind}:${item.id}` === targetKey) ?? null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!weapon || !target) {
      setLocalError("Escolha arma e alvo.");
      return;
    }
    setLocalError(null);
    await onAttack({
      inventoryItemId: weapon.inventoryItemId,
      targetKind: target.kind,
      targetId: target.id,
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="size-5 text-[#d9a3a8]" /> Atacar
          </DialogTitle>
          <DialogDescription>
            {character.name} ataca com uma arma do inventário. O servidor rola
            d20, compara com a CA e aplica o dano.
          </DialogDescription>
        </DialogHeader>

        {weapons.length ? (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="weapon-select">Arma</Label>
              <select
                id="weapon-select"
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                value={weaponId}
                onChange={(event) => setWeaponId(event.target.value)}
              >
                {weapons.map((item) => (
                  <option key={item.inventoryItemId} value={item.inventoryItemId}>
                    {item.name} ({weaponDamage(item)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="weapon-target">Alvo</Label>
              {targets.length ? (
                <select
                  id="weapon-target"
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                  value={targetKey}
                  onChange={(event) => setTargetKey(event.target.value)}
                >
                  {targets.map((item) => (
                    <option
                      key={`${item.kind}:${item.id}`}
                      value={`${item.kind}:${item.id}`}
                    >
                      {item.name}
                      {typeof item.currentHp === "number" &&
                      typeof item.maxHp === "number"
                        ? ` (${item.currentHp}/${item.maxHp})`
                        : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-destructive">Nenhum alvo disponível.</p>
              )}
            </div>

            {weapon ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  {weapon.name} · {weaponDamage(weapon)}
                </span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  d20 + prof. + mod.
                </Badge>
              </div>
            ) : null}

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
              <Button type="submit" disabled={busy || !weapon || !target}>
                {busy ? "Atacando..." : "Atacar"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Nenhuma arma no inventário. Adicione uma arma na ficha para atacar.
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
