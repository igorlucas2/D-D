"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { playerColor } from "@/lib/player-color";
import type { DiceRoll, DiceVisibility } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { useTablePrefsStore } from "@/stores/table-prefs-store";
import { describeBreakdown, rollerName, rollHighlight } from "@/components/campaigns/dice-tray";

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;

const VISIBILITY_LABELS: Record<DiceVisibility, string> = {
  PUBLIC: "Pública",
  MASTER: "Só mestre",
  PRIVATE: "Privada",
};

interface TableDiceControlsProps {
  campaignId: string;
  isMaster: boolean;
  characterId: string | null;
  rolls: DiceRoll[];
  onRolled: (roll: DiceRoll) => void;
}

// Rolagem na mesa (IM-04). O servidor sorteia e decide quem recebe; aqui só se
// monta a fórmula e se mostra o histórico autorizado.
export function TableDiceControls({ campaignId, isMaster, characterId, rolls, onRolled }: TableDiceControlsProps) {
  const token = useAuthStore((state) => state.token);
  const diceAnimation = useTablePrefsStore((state) => state.diceAnimation);
  const setDiceAnimation = useTablePrefsStore((state) => state.setDiceAnimation);
  const [sides, setSides] = useState<(typeof DICE)[number]>(20);
  const [count, setCount] = useState("1");
  const [modifier, setModifier] = useState("0");
  const [visibility, setVisibility] = useState<DiceVisibility>("PUBLIC");
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diceCount = Math.min(10, Math.max(1, Math.trunc(Number(count)) || 1));
  const mod = Math.trunc(Number(modifier)) || 0;
  const formula = `${diceCount}d${sides}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ""}`;
  // Para o mestre, "só mestre" e "privada" são a mesma coisa.
  const visibilityOptions: DiceVisibility[] = isMaster ? ["PUBLIC", "PRIVATE"] : ["PUBLIC", "MASTER", "PRIVATE"];

  async function roll() {
    if (!token || rolling) return;
    setRolling(true);
    setError(null);
    try {
      const result = await api.post<DiceRoll>(
        "/dice/roll",
        { formula, campaignId, visibility, characterId: characterId ?? undefined },
        token,
      );
      onRolled(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível rolar os dados.");
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
      <div role="group" aria-label="Tipo de dado" className="flex flex-wrap gap-1.5">
        {DICE.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={sides === option ? "default" : "outline"}
            aria-pressed={sides === option}
            className="min-h-11 min-w-12"
            onClick={() => setSides(option)}
          >
            d{option}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="diceCount" className="text-xs text-muted-foreground">Quantidade</Label>
          <Input id="diceCount" type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} className="h-11 w-20" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="diceModifier" className="text-xs text-muted-foreground">Modificador</Label>
          <Input id="diceModifier" type="number" min={-100} max={100} value={modifier} onChange={(e) => setModifier(e.target.value)} className="h-11 w-24" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="diceVisibility" className="text-xs text-muted-foreground">Quem vê</Label>
          <select
            id="diceVisibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as DiceVisibility)}
            className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {visibilityOptions.map((option) => (
              <option key={option} value={option}>
                {option === "PRIVATE" && isMaster ? "Oculta (só você)" : VISIBILITY_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        <Button className="h-11" disabled={rolling} onClick={() => void roll()}>
          {rolling ? "Rolando..." : `Rolar ${formula}`}
        </Button>
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={diceAnimation === "result"}
            onChange={(e) => setDiceAnimation(e.target.checked ? "result" : "physics")}
            className="size-4 accent-[var(--rpg-bronze)]"
          />
          Só o resultado (sem animação)
        </label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Rolagens recentes</h4>
        {rolls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma rolagem nesta mesa ainda.</p>
        ) : (
          <ol aria-live="polite" className="flex max-h-48 flex-col gap-1 overflow-auto pr-1">
            {rolls.map((roll) => {
              const highlight = rollHighlight(roll);
              const breakdown = describeBreakdown(roll);
              return (
                <li key={roll.id} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md px-2 py-1 text-sm odd:bg-background/40">
                  <span className="min-w-0">
                    <span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-full" style={{ backgroundColor: playerColor(roll.userId) }} />
                    <span className="font-medium">{rollerName(roll)}</span>{" "}
                    <span className="text-muted-foreground tabular-nums">{roll.formula}</span>
                    {roll.visibility !== "PUBLIC" ? (
                      <span className="ml-1 text-xs text-muted-foreground">· {roll.visibility === "MASTER" ? "só mestre" : "privada"}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums">
                    <strong className="text-base">{roll.result}</strong>
                    {breakdown ? <span className="ml-1 text-xs text-muted-foreground">({breakdown})</span> : null}
                    {highlight ? (
                      <span className={`ml-1 text-xs font-semibold ${highlight === "critical" ? "text-primary" : "text-destructive"}`}>
                        {highlight === "critical" ? "crítico" : "falha"}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
