"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useStoryUpdates } from "@/lib/use-story-updates";
import { useAuthStore } from "@/stores/auth-store";

type AiMode = "OFF" | "COPILOT" | "AUTONOMOUS";

interface AiState {
  mode: AiMode;
  paused: boolean;
  revision: number;
  isMaster: boolean;
  storyReady: boolean;
  scene: {
    name: string;
    phase: string;
    gameMinute: number;
    weather: string;
  } | null;
  characters: Array<{ id: string; name: string; isMine: boolean }>;
  events: Array<{
    eventId: string;
    sequence: number;
    gameMinute: number;
    summary: string;
    narration: string | null;
  }>;
  provider: { available: boolean; model: string; reason?: string };
}

interface AiTurnResult {
  eventId: string | null;
  narration: string;
  ask: string | null;
  memory: { summary: string; openQuestions: string[] } | null;
  alreadyApplied: boolean;
  persisted: boolean;
  model: string | null;
  latencyMs: number | null;
}

const textareaClassName =
  "min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function AiMasterContent() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const [state, setState] = useState<AiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const next = await api.get<AiState>(
        `/campaigns/${params.id}/ai-master/state`,
        token,
      );
      setState(next);
      setCharacterId((current) => {
        if (current && next.characters.some((item) => item.id === current)) {
          return current;
        }
        return next.characters.find((item) => item.isMine)?.id ?? "";
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o mestre IA.",
      );
    } finally {
      setLoading(false);
    }
  }, [params.id, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da tela
    void load();
  }, [load]);

  useStoryUpdates(params.id, token, load);

  async function changeMode(mode: AiMode, paused: boolean) {
    if (!token || !state || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(
        `/campaigns/${params.id}/ai-master/settings`,
        { mode, paused, expectedRevision: state.revision },
        token,
      );
      setNotice(
        mode === "AUTONOMOUS" && !paused
          ? "Mestre IA ligado."
          : "Mestre IA atualizado.",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível configurar o mestre IA.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !state || busy || !action.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.post<AiTurnResult>(
        `/campaigns/${params.id}/ai-master/act`,
        {
          requestKey: crypto.randomUUID(),
          action: action.trim(),
          characterId: characterId || undefined,
          expectedRevision: state.revision,
        },
        token,
      );
      setAction("");
      setNotice(
        result.ask
          ? `O mestre pergunta: ${result.ask}`
          : result.narration,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "O mestre IA não conseguiu responder.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-muted-foreground">
        Carregando o mestre IA...
      </div>
    );
  }

  const mine = state?.characters.filter((item) => item.isMine) ?? [];
  const active =
    state?.storyReady && state.mode === "AUTONOMOUS" && !state.paused;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href={`/campaigns/${params.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar para a mesa
        </Link>
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          <Sparkles className="size-4" /> Mesa narrada
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold">
          Mestre IA local
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O modelo narra a consequência da sua ação. Dados, PV e mudanças de
          estado continuam com o motor da mesa.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={active ? "default" : "outline"}>
          {state?.mode === "AUTONOMOUS"
            ? state.paused
              ? "Pausado"
              : "Autônomo"
            : state?.mode === "COPILOT"
              ? "Copiloto"
              : "Desligado"}
        </Badge>
        <Badge variant="outline">
          {state?.provider.available
            ? `Modelo ${state.provider.model}`
            : "Modelo indisponível"}
        </Badge>
        {state?.scene ? (
          <Badge variant="outline">
            {state.scene.name} · {state.scene.phase.toLowerCase()}
          </Badge>
        ) : null}
      </div>

      {state?.isMaster ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controles do mestre</CardTitle>
            <CardDescription>
              Ligue o modo autônomo quando o grupo estiver pronto para jogar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              onClick={() => void changeMode("AUTONOMOUS", false)}
              disabled={busy}
            >
              Ligar mestre IA
            </Button>
            <Button
              variant="outline"
              onClick={() => void changeMode("AUTONOMOUS", !state.paused)}
              disabled={busy || state.mode !== "AUTONOMOUS"}
            >
              {state.paused ? "Retomar" : "Pausar"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void changeMode("OFF", false)}
              disabled={busy}
            >
              Desligar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm whitespace-pre-wrap">
          {notice}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações recentes</CardTitle>
          <CardDescription>
            Últimas narrações públicas registradas na memória da campanha.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {state?.events.length ? (
            state.events.map((event) => (
              <article
                key={event.eventId}
                className="rounded-lg border border-border/70 p-3 text-sm"
              >
                <p className="text-xs text-muted-foreground">
                  #{event.sequence} · {event.gameMinute} min de jogo
                </p>
                <p className="mt-1 whitespace-pre-wrap">
                  {event.narration ?? event.summary}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma narração ainda nesta campanha.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que você faz?</CardTitle>
          <CardDescription>
            Descreva a ação do seu personagem. O mestre narra o resultado
            imediato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitAction} className="flex flex-col gap-3">
            {mine.length > 0 ? (
              <label className="flex flex-col gap-1 text-sm">
                Personagem
                <select
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                  value={characterId}
                  onChange={(event) => setCharacterId(event.target.value)}
                >
                  {mine.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você não tem personagem nesta campanha. Peça ao mestre para
                criar um ou use a mesa manual.
              </p>
            )}
            <textarea
              className={textareaClassName}
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="Ex.: Examino a porta atrás do balcão e pergunto ao taverneiro o que ele ouviu naquela noite."
              maxLength={1000}
              disabled={!active || busy}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {!state?.storyReady
                  ? "Inicie a memória do cenário antes de jogar com o mestre IA."
                  : active
                    ? "A narração é registrada no diário público."
                    : "O mestre precisa ligar o modo autônomo para responder."}
              </span>
              <Button
                type="submit"
                disabled={!active || busy || !action.trim() || mine.length === 0}
              >
                {busy ? "O mestre está narrando..." : "Enviar ação"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AiMasterPage() {
  return (
    <RequireAuth>
      <AiMasterContent />
    </RequireAuth>
  );
}
