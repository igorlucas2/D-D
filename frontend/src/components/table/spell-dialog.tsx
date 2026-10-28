"use client";

import { useMemo, useState } from "react";
import { Flame, HeartPulse, Sparkles } from "lucide-react";
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
import type {
  ActionTarget,
  HudCharacter,
  HudSpell,
} from "@/lib/table-types";

export interface SpellCastInput {
  characterSpellId: string;
  slotLevel?: number;
  targets: Array<{ kind: "CHARACTER" | "PARTICIPANT"; id: string }>;
}

function targetKey(target: { kind: string; id: string }) {
  return `${target.kind}:${target.id}`;
}

function defaultTargetsFor(
  spell: HudSpell | null,
  character: HudCharacter,
  targets: ActionTarget[],
): Set<string> {
  if (!spell || spell.effectKind === "DAMAGE") return new Set();
  return new Set(
    targets
      .filter((target) => target.characterId === character.characterId)
      .slice(0, 1)
      .map(targetKey),
  );
}

export function SpellDialog({
  character,
  targets,
  busy,
  onOpenChange,
  onCast,
}: {
  character: HudCharacter;
  targets: ActionTarget[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCast: (input: SpellCastInput) => Promise<void>;
}) {
  const spells = character.spells;
  const [selectedSpellId, setSelectedSpellId] = useState(
    spells[0]?.characterSpellId ?? "",
  );
  const selectedSpell =
    spells.find((spell) => spell.characterSpellId === selectedSpellId) ??
    spells[0] ??
    null;
  const [slotLevel, setSlotLevel] = useState(
    selectedSpell
      ? Math.max(selectedSpell.level, 1)
      : 1,
  );
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(
    defaultTargetsFor(spells[0] ?? null, character, targets),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const availableSlots = useMemo(() => {
    if (!selectedSpell || selectedSpell.level === 0) return [];
    return character.spellSlots.filter(
      (slot) =>
        slot.level >= selectedSpell.level && slot.total - slot.used > 0,
    );
  }, [character.spellSlots, selectedSpell]);

  function chooseSpell(spell: HudSpell) {
    setSelectedSpellId(spell.characterSpellId);
    setSlotLevel(Math.max(spell.level, 1));
    setSelectedTargets(defaultTargetsFor(spell, character, targets));
    setLocalError(null);
  }

  function toggleTarget(target: ActionTarget) {
    if (!selectedSpell) return;
    const key = targetKey(target);
    if (selectedSpell.targetMode === "SINGLE") {
      setSelectedTargets(new Set([key]));
      return;
    }
    setSelectedTargets((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSpell) {
      setLocalError("Escolha uma magia.");
      return;
    }
    if (selectedSpell.level > 0 && availableSlots.length === 0) {
      setLocalError("Não há espaço de magia disponível.");
      return;
    }
    if (selectedTargets.size === 0) {
      setLocalError("Escolha pelo menos um alvo.");
      return;
    }
    if (selectedSpell.targetMode === "SINGLE" && selectedTargets.size !== 1) {
      setLocalError("Esta magia exige exatamente um alvo.");
      return;
    }
    setLocalError(null);
    const selected = [...selectedTargets].map((key) => {
      const [kind, ...rest] = key.split(":");
      return { kind: kind as "CHARACTER" | "PARTICIPANT", id: rest.join(":") };
    });
    await onCast({
      characterSpellId: selectedSpell.characterSpellId,
      slotLevel: selectedSpell.level === 0 ? undefined : slotLevel,
      targets: selected,
    });
  }

  if (!spells.length) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conjurar</DialogTitle>
            <DialogDescription>
              Nenhuma magia com mecânica utilizável está preparada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Conjurar
          </DialogTitle>
          <DialogDescription>
            {character.name} gasta o espaço no servidor. Dano, cura e save são
            resolvidos pelo motor; o mestre narra depois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-2">
            {spells.map((spell) => {
              const Icon =
                spell.effectKind === "DAMAGE"
                  ? Flame
                  : spell.effectKind === "MARK"
                    ? Sparkles
                    : HeartPulse;
              const selected = spell.characterSpellId === selectedSpell?.characterSpellId;
              return (
                <label
                  key={spell.characterSpellId}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                    selected
                      ? "border-primary/60 bg-primary/8"
                      : "border-border/70 hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="spell"
                    className="sr-only"
                    checked={selected}
                    onChange={() => chooseSpell(spell)}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{spell.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {spell.level === 0 ? "Truque" : `Nível ${spell.level}`} ·{" "}
                          {spell.school} ·{" "}
                          {spell.effectKind === "HEAL"
                            ? "cura"
                            : spell.effectKind === "MARK"
                              ? "marca"
                              : spell.effectKind === "BUFF"
                                ? "bênção"
                                : "dano"}
                          {spell.actionType === "BONUS"
                            ? " · ação bônus"
                            : spell.actionType === "REACTION"
                              ? " · reação"
                              : ""}
                          {spell.targetMode === "MULTIPLE" ? " em área" : ""}
                        </p>
                      </div>
                    </div>
                    {spell.concentration ? (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        concentração
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
                    {spell.effectKind === "MARK"
                      ? "+1d6 em ataques contra o alvo marcado"
                      : spell.effectKind === "BUFF"
                        ? spell.name === "Escudo da Fé"
                          ? "+2 CA por concentração"
                          : spell.name === "Escudo Arcano"
                            ? "+5 CA por 1 rodada"
                            : "+1d4 em ataques e salvaguardas"
                        : spell.formula}
                    {spell.attack
                      ? " · ataque mágico"
                      : spell.saveAbility
                        ? ` · save ${spell.saveAbility}${spell.halfOnSuccess ? " (metade no sucesso)" : ""}`
                        : ""}
                  </p>
                </label>
              );
            })}
          </div>

          {selectedSpell && selectedSpell.level > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spell-slot">Espaço de magia</Label>
              <select
                id="spell-slot"
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                value={slotLevel}
                onChange={(event) => setSlotLevel(Number(event.target.value))}
              >
                {availableSlots.length ? (
                  availableSlots.map((slot) => (
                    <option key={slot.level} value={slot.level}>
                      Nível {slot.level} ({slot.total - slot.used}{" "}
                      {slot.total - slot.used === 1 ? "disponível" : "disponíveis"})
                    </option>
                  ))
                ) : (
                  <option value={slotLevel}>Sem espaço disponível</option>
                )}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>Alvos</Label>
            {targets.length ? (
              <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border/70 p-2">
                {targets.map((target) => {
                  const key = targetKey(target);
                  const checked = selectedTargets.has(key);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/40"
                    >
                      <input
                        type={selectedSpell?.targetMode === "SINGLE" ? "radio" : "checkbox"}
                        name={selectedSpell?.targetMode === "SINGLE" ? "spell-target" : undefined}
                        checked={checked}
                        onChange={() => toggleTarget(target)}
                        className="size-3.5 accent-[var(--rpg-gold)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{target.name}</span>
                      {typeof target.currentHp === "number" && typeof target.maxHp === "number" ? (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {target.currentHp}/{target.maxHp}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-destructive">Nenhum alvo disponível.</p>
            )}
          </div>

          {selectedSpell ? (
            <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {selectedSpell.name} em {selectedTargets.size} alvo
              {selectedTargets.size === 1 ? "" : "s"} ·{" "}
              {selectedSpell.level === 0
                ? "truque, sem slot"
                : `espaço nível ${slotLevel}`}
            </p>
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
            <Button
              type="submit"
              disabled={
                busy ||
                !selectedSpell ||
                selectedTargets.size === 0 ||
                (selectedSpell.level > 0 && availableSlots.length === 0)
              }
            >
              {busy ? "Conjurando..." : "Conjurar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
