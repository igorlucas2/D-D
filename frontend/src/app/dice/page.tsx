"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AmbientParticles } from "@/components/ornamental/ambient-particles";
import { Crest, OrnateDivider } from "@/components/ornamental/ornate-divider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Character, DiceRoll } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

const Die3D = dynamic(
  () => import("@/components/ornamental/dice-roller").then((mod) => mod.Die3D),
  { ssr: false },
);

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm";

function DiceContent() {
  const token = useAuthStore((state) => state.token);
  const [diceCount, setDiceCount] = useState(1);
  const [diceSides, setDiceSides] = useState(20);
  const [modifier, setModifier] = useState(0);
  const [characterId, setCharacterId] = useState<string>("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [history, setHistory] = useState<DiceRoll[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollToken, setRollToken] = useState(0);
  const [revealResults, setRevealResults] = useState<number[] | null>(null);
  const [pendingResults, setPendingResults] = useState<number[] | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<Character[]>("/characters", token)
      .then(setCharacters)
      .catch((err) =>
        setError((current) =>
          current ??
          (err instanceof ApiError
            ? err.message
            : "Não foi possível carregar os personagens."),
        ),
      );
    api
      .get<DiceRoll[]>("/dice/history", token)
      .then(setHistory)
      .catch(() =>
        setError(
          (current) =>
            current ?? "Não foi possível carregar o histórico de rolagens.",
        ),
      );
  }, [token]);

  const formula = `${diceCount}d${diceSides}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : ""}`;

  async function handleRoll() {
    if (!token || rolling) return;
    setError(null);
    setRolling(true);
    setRevealResults(null);
    try {
      const roll = await api.post<DiceRoll>(
        "/dice/roll",
        { formula, characterId: characterId || undefined },
        token,
      );
      setHistory((prev) => [roll, ...prev].slice(0, 50));
      setPendingResults(roll.breakdown.rolls);
      setRollToken((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível rolar os dados.");
      setRolling(false);
    }
  }

  function handleSettle() {
    setRevealResults(pendingResults);
    setRolling(false);
  }

  const lastRoll = history[0];

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <AmbientParticles className="-z-10" />

      <div>
        <div className="flex items-center gap-2">
          <Crest className="h-6 w-6 text-primary" />
          <h1 className="text-glow-primary font-heading text-3xl font-bold tracking-wide">
            Rolagem de dados
          </h1>
        </div>
        <p className="text-muted-foreground">
          Monte sua fórmula e role. O histórico fica salvo na sua conta.
        </p>
      </div>

      <OrnateDivider />

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>Configurar rolagem</CardTitle>
          <CardDescription>Fórmula atual: {formula}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {DICE_SIDES.map((sides) => (
              <Button
                key={sides}
                type="button"
                variant={diceSides === sides ? "default" : "outline"}
                onClick={() => setDiceSides(sides)}
              >
                d{sides}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="diceCount">Quantidade de dados</Label>
              <Input
                id="diceCount"
                type="number"
                min={1}
                max={20}
                value={diceCount}
                onChange={(event) => setDiceCount(Math.max(1, Math.min(20, Number(event.target.value))))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="modifier">Modificador</Label>
              <Input
                id="modifier"
                type="number"
                value={modifier}
                onChange={(event) => setModifier(Number(event.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="character">Personagem (opcional)</Label>
              <select
                id="character"
                className={selectClassName}
                value={characterId}
                onChange={(event) => setCharacterId(event.target.value)}
              >
                <option value="">Nenhum</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col items-center gap-4">
            <Button onClick={handleRoll} disabled={rolling}>
              {rolling ? "Rolando..." : "Rolar"}
            </Button>
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: diceCount }).map((_, index) => (
                <Die3D
                  key={index}
                  sides={diceSides}
                  rollToken={rollToken}
                  result={revealResults?.[index] ?? null}
                  onSettle={index === 0 ? handleSettle : undefined}
                  size="h-20 w-20"
                />
              ))}
            </div>
          </div>

          {lastRoll ? (
            <div className="shadow-glow-primary rounded-lg border border-primary/30 bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">{lastRoll.formula}</p>
              <p className="text-glow-primary font-heading text-3xl font-bold text-primary">
                {lastRoll.result}
              </p>
              <p className="text-xs text-muted-foreground">
                [{lastRoll.breakdown.rolls.join(", ")}]
                {lastRoll.breakdown.modifier !== 0
                  ? ` ${lastRoll.breakdown.modifier > 0 ? "+" : ""}${lastRoll.breakdown.modifier}`
                  : ""}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma rolagem ainda.</p>
          ) : (
            history.map((roll) => (
              <div
                key={roll.id}
                className="flex items-center justify-between border-b border-border/40 pb-2 text-sm last:border-0 last:pb-0"
              >
                <span>
                  {roll.formula}
                  {roll.character ? ` • ${roll.character.name}` : ""}
                </span>
                <span className="font-semibold tabular-nums">{roll.result}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DicePage() {
  return (
    <RequireAuth>
      <DiceContent />
    </RequireAuth>
  );
}
