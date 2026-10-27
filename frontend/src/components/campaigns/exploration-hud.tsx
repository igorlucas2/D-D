"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { api, ApiError } from "@/lib/api";
import type { Character, CharacterExplorationState } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { BedDouble, Footprints, Moon } from "lucide-react";

interface ExplorationHudProps {
  campaignId: string;
  characterId: string | null;
  state: CharacterExplorationState | null;
  onCharacterChange: (characterId: string | null) => void;
  onStateChange: (state: CharacterExplorationState | null) => void;
}

export function ExplorationHud({
  campaignId,
  characterId,
  state,
  onCharacterChange,
  onStateChange,
}: ExplorationHudProps) {
  const token = useAuthStore((authState) => authState.token);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [resting, setResting] = useState<"short" | "long" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    api
      .get<Character[]>("/characters", token)
      .then((data) => {
        if (cancelled) return;
        setCharacters(data);
        if (!characterId && data.length > 0) {
          onCharacterChange(data[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erro ao carregar personagens.");
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !characterId) {
      onStateChange(null);
      return;
    }
    let cancelled = false;

    api
      .get<CharacterExplorationState>(
        `/campaigns/${campaignId}/characters/${characterId}/exploration`,
        token,
      )
      .then((data) => {
        if (!cancelled) onStateChange(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erro ao carregar estado de exploração.");
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, campaignId, characterId]);

  async function handleRest(type: "short" | "long") {
    if (!token || !characterId) return;
    const label = type === "long" ? "longo (8 horas)" : "curto (1 hora)";
    const confirmed = window.confirm(`Fazer um descanso ${label}? O tempo do mundo avançará.`);
    if (!confirmed) return;

    setResting(type);
    setError(null);
    try {
      const result = await api.post<{ state: CharacterExplorationState }>(
        `/campaigns/${campaignId}/characters/${characterId}/rest`,
        { type },
        token,
      );
      onStateChange(result.state);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível descansar.");
    } finally {
      setResting(null);
    }
  }

  if (characters.length === 0) return null;

  const recommendRest = state ? state.actionPoints === 0 || state.fatigue > 0 : false;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Footprints className="h-5 w-5" /> Exploração
        </CardTitle>
        {characters.length > 1 ? (
          <FilterSelect
            value={characterId ?? ""}
            onChange={(value) => onCharacterChange(value || null)}
            options={characters.map((character) => character.id)}
            labels={Object.fromEntries(characters.map((character) => [character.id, character.name]))}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{characters[0].name}</span>
        )}
      </CardHeader>
      {state ? (
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            Ações: {state.actionPoints}/{state.maxActionPoints}
          </Badge>
          {state.fatigue > 0 ? <Badge variant="outline">Fadiga: {state.fatigue}</Badge> : null}
          {recommendRest ? <Badge>Próximo descanso recomendado</Badge> : null}
          <Button
            size="sm"
            variant="outline"
            disabled={resting !== null}
            onClick={() => handleRest("short")}
          >
            <Moon className="h-4 w-4" /> {resting === "short" ? "..." : "Descanso curto"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={resting !== null}
            onClick={() => handleRest("long")}
          >
            <BedDouble className="h-4 w-4" /> {resting === "long" ? "..." : "Descanso longo"}
          </Button>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
