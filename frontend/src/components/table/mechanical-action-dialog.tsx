"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTION_LABELS,
  DAMAGE_TYPE_LABELS,
  type ActionTarget,
  type CombatActionKind,
  type DamageType,
  type MechanicalActionInput,
} from "@/lib/table-types";

const DAMAGE_TYPES = Object.keys(DAMAGE_TYPE_LABELS) as DamageType[];

export function MechanicalActionDialog({
  open,
  kind,
  targets,
  defaultTargetId,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  kind: CombatActionKind;
  targets: ActionTarget[];
  defaultTargetId: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: MechanicalActionInput) => Promise<void>;
}) {
  const availableTargets = useMemo(
    () =>
      kind === "CONDITION"
        ? targets.filter((target) => target.kind === "PARTICIPANT")
        : targets,
    [kind, targets],
  );
  const [targetId, setTargetId] = useState(
    availableTargets.find((target) => target.id === defaultTargetId)?.id ??
      availableTargets[0]?.id ??
      "",
  );
  const [valueMode, setValueMode] = useState<"amount" | "formula">("amount");
  const [amount, setAmount] = useState("5");
  const [formula, setFormula] = useState("1d8+2");
  const [damageType, setDamageType] = useState<DamageType>("untyped");
  const [condition, setCondition] = useState("");
  const [conditionMode, setConditionMode] = useState<"ADD" | "REMOVE">("ADD");
  const [durationRounds, setDurationRounds] = useState("0");
  const [source, setSource] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const target = availableTargets.find((item) => item.id === targetId) ?? null;
  const isCondition = kind === "CONDITION";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) {
      setLocalError("Escolha um alvo.");
      return;
    }
    setLocalError(null);
    const input: MechanicalActionInput = {
      kind,
      targetKind: target.kind,
      targetId: target.id,
      source: source.trim() || undefined,
    };
    if (isCondition) {
      if (!condition.trim()) {
        setLocalError("Descreva a condição.");
        return;
      }
      input.condition = condition.trim();
      input.conditionMode = conditionMode;
      if (conditionMode === "ADD") {
        const rounds = Number(durationRounds);
        if (
          durationRounds.trim() &&
          (!Number.isInteger(rounds) || rounds < 0 || rounds > 50)
        ) {
          setLocalError("Duração deve ser um inteiro entre 0 e 50 rodadas.");
          return;
        }
        if (rounds > 0) input.durationRounds = rounds;
      }
    } else if (kind === "TEMP_HP" || valueMode === "amount") {
      const parsed = Number(amount);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
        setLocalError("Informe um valor inteiro entre 1 e 999.");
        return;
      }
      input.amount = parsed;
      if (kind === "DAMAGE") input.damageType = damageType;
    } else {
      if (!/^\d{1,2}d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i.test(formula.trim())) {
        setLocalError("Fórmula inválida. Use algo como 2d6+3.");
        return;
      }
      input.formula = formula.trim().toLowerCase();
      if (kind === "DAMAGE") input.damageType = damageType;
    }
    await onSubmit(input);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[kind]}</DialogTitle>
          <DialogDescription>
            O motor calcula e aplica; o mestre narra depois. Nada é alterado
            antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="action-target">Alvo</Label>
            {availableTargets.length ? (
              <select
                id="action-target"
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                {availableTargets.map((item) => (
                  <option key={`${item.kind}:${item.id}`} value={item.id}>
                    {item.name}
                    {typeof item.currentHp === "number" && typeof item.maxHp === "number"
                      ? ` (${item.currentHp}/${item.maxHp})`
                      : ""}
                    {item.kind === "PARTICIPANT" ? "" : " · ficha"}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-destructive">
                {isCondition
                  ? "Condições exigem um combate ativo com participantes."
                  : "Nenhum alvo disponível."}
              </p>
            )}
          </div>

          {!isCondition ? (
            <>
              {kind !== "TEMP_HP" ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={valueMode === "amount" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setValueMode("amount")}
                  >
                    Valor fixo
                  </Button>
                  <Button
                    type="button"
                    variant={valueMode === "formula" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setValueMode("formula")}
                  >
                    Fórmula
                  </Button>
                </div>
              ) : null}

              {kind === "TEMP_HP" || valueMode === "amount" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="action-amount">
                    {kind === "DAMAGE" ? "Dano" : kind === "HEAL" ? "Cura" : "PV temporário"}
                  </Label>
                  <Input
                    id="action-amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="action-formula">Fórmula</Label>
                  <Input
                    id="action-formula"
                    value={formula}
                    onChange={(event) => setFormula(event.target.value)}
                    placeholder="2d6+3"
                  />
                </div>
              )}

              {kind === "DAMAGE" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="action-damage-type">Tipo de dano</Label>
                  <select
                    id="action-damage-type"
                    className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                    value={damageType}
                    onChange={(event) =>
                      setDamageType(event.target.value as DamageType)
                    }
                  >
                    {DAMAGE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DAMAGE_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-condition">Condição</Label>
                <Input
                  id="action-condition"
                  value={condition}
                  onChange={(event) => setCondition(event.target.value)}
                  placeholder="Caído, Amedrontado, Envenenado..."
                  maxLength={60}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={conditionMode === "ADD" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setConditionMode("ADD")}
                >
                  Adicionar
                </Button>
                <Button
                  type="button"
                  variant={conditionMode === "REMOVE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setConditionMode("REMOVE")}
                >
                  Remover
                </Button>
              </div>
              {conditionMode === "ADD" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="action-duration">
                    Duração em rodadas (0 = sem prazo)
                  </Label>
                  <Input
                    id="action-duration"
                    inputMode="numeric"
                    value={durationRounds}
                    onChange={(event) => setDurationRounds(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="action-source">Origem (opcional)</Label>
            <Input
              id="action-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Ex.: armadilha, queda, poção"
              maxLength={80}
            />
          </div>

          {target ? (
            <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {isCondition
                ? `${conditionMode === "ADD" ? "Adicionar" : "Remover"} “${condition || "condição"}” em ${target.name}.`
                : `${target.name}: ${valueMode === "formula" && kind !== "TEMP_HP" ? formula : amount} de ${ACTION_LABELS[kind].toLowerCase()}.`}
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
            <Button type="submit" disabled={busy || !target}>
              {busy ? "Aplicando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
