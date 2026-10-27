"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useStoryUpdates } from "@/lib/use-story-updates";
import { useAuthStore } from "@/stores/auth-store";

type Turn = {
  id: string;
  parentTurnId: string | null;
  playerEntityId: string;
  character: string;
  npc: string | null;
  focusEntityId: string | null;
  prompt: string;
  status: string;
  reply: string | null;
  replyKind: string | null;
  current: boolean;
  mine: boolean;
  canReply: boolean;
  canCancel: boolean;
  proposal?: { kind: string; text: string } | null;
  draftCurrent?: boolean;
  sources?: { id: string; text: string }[];
  errorCode?: string | null;
};
type State = {
  master: boolean;
  scene: { name: string; revision: number };
  revision?: number;
  characters: { id: string; name: string }[];
  npcs: { id: string; name: string }[];
  turns: Turn[];
  mode?: string;
  paused?: boolean;
};
const card = "rounded-xl border border-border/70 bg-card/80 p-5";
const field =
  "mt-2 block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const statuses: Record<string, string> = {
  REQUESTED: "Preparando rascunho",
  GENERATING: "Preparando rascunho",
  READY: "Aguardando revisão",
  WAITING_MASTER: "Aguardando o mestre",
  FAILED: "Resposta manual disponível",
  STALE: "Revisar estado atual",
  WAITING_PLAYER: "Aguardando esclarecimento",
  COMMITTED: "Respondida",
  CANCELLED: "Cancelada",
};
type SendIntent = (
  prompt: string,
  character: string,
  npc: string,
  parent?: string,
) => Promise<boolean>;

function FollowUp({
  turn,
  busy,
  send,
}: {
  turn: Turn;
  busy: boolean;
  send: SendIntent;
}) {
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        await send(
          String(new FormData(form).get("reply") ?? ""),
          turn.playerEntityId,
          turn.focusEntityId ?? "",
          turn.id,
        );
      }}
    >
      <label className="block text-sm">
        Seu esclarecimento
        <textarea
          aria-label="Seu esclarecimento"
          name="reply"
          className={field}
          required
          maxLength={1500}
          rows={3}
          disabled={busy}
        />
      </label>
      <Button type="submit" disabled={busy}>
        Responder à pergunta
      </Button>
    </form>
  );
}
function MasterReply({
  turn,
  busy,
  respond,
}: {
  turn: Turn;
  busy: boolean;
  respond: (
    id: string,
    text: string,
    kind: string,
    source: string,
  ) => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [kind, setKind] = useState("ANSWER"),
    [source, setSource] = useState("MANUAL");
  return (
    <form
      className="mt-4 space-y-3 border-t border-border pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await respond(turn.id, text, kind, source);
      }}
    >
      {turn.proposal && (
        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Rascunho reservado ao mestre
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">
            {turn.proposal.text}
          </p>
          {!!turn.sources?.length && (
            <details className="text-sm">
              <summary className="cursor-pointer py-2">
                Fontes consultadas
              </summary>
              {turn.sources.map((s) => (
                <p key={s.id} className="my-2 whitespace-pre-wrap break-words">
                  {s.text}
                </p>
              ))}
            </details>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy || !turn.draftCurrent}
            onClick={() => {
              setText(turn.proposal!.text);
              setKind(turn.proposal!.kind);
              setSource("DRAFT");
            }}
          >
            Usar rascunho
          </Button>
          {!turn.draftCurrent && (
            <p className="text-sm text-muted-foreground">
              Este rascunho ficou desatualizado. Confira o estado atual antes de
              responder manualmente.
            </p>
          )}
        </div>
      )}
      <label className="block text-sm">
        Resposta do mestre
        <textarea
          aria-label="Resposta do mestre"
          className={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          maxLength={2000}
          rows={4}
          disabled={busy}
        />
      </label>
      <label className="block text-sm">
        Como continuar
        <select
          aria-label="Como continuar"
          className={field}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={busy}
        >
          <option value="ANSWER">Responder e concluir esta intenção</option>
          <option value="ASK">Pedir esclarecimento ao jogador</option>
        </select>
      </label>
      {source === "DRAFT" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Rascunho selecionado para revisão.</span>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => setSource("MANUAL")}
          >
            Continuar como resposta manual
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Somente você e o autor recebem esta resposta. Viagens, descobertas e
        outros efeitos são registrados separadamente nos comandos da mesa.
      </p>
      <Button
        type="submit"
        disabled={
          busy || !text.trim() || (source === "DRAFT" && !turn.draftCurrent)
        }
      >
        Enviar ao jogador
      </Button>
    </form>
  );
}

function Intents({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef(true),
    sequence = useRef(0),
    pending = useRef(new Map<string, Record<string, unknown>>());
  const load = useCallback(async () => {
    const n = ++sequence.current;
    try {
      const next = await api.get<State>(`/campaigns/${id}/intents`, token);
      if (active.current && n === sequence.current) {
        setState(next);
        setError("");
      }
    } catch (e) {
      if (active.current && n === sequence.current) {
        setError(
          e instanceof Error ? e.message : "Falha ao carregar as intenções.",
        );
        if (e instanceof ApiError && [401, 403, 404, 409].includes(e.status))
          setState(null);
      }
    }
  }, [id, token]);
  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(load);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active.current = false;
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  useStoryUpdates(id, token, load);
  const send: SendIntent = async (prompt, character, npc, parent) => {
    if (!state || !prompt.trim()) return false;
    setBusy(true);
    setNotice("");
    const signature = JSON.stringify([prompt.trim(), character, npc, parent]);
    if (!pending.current.has(signature))
      pending.current.set(signature, {
        requestKey: crypto.randomUUID(),
        prompt: prompt.trim(),
        playerEntityId: character,
        expectedSceneRevision: state.scene.revision,
        ...(npc ? { focusEntityId: npc } : {}),
        ...(parent ? { parentTurnId: parent } : {}),
      });
    try {
      await api.post(
        `/campaigns/${id}/intents`,
        pending.current.get(signature),
        token,
      );
      pending.current.delete(signature);
      setNotice(
        "Intenção salva. O mestre poderá responder ou pedir um esclarecimento.",
      );
      await load();
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao enviar.");
      if (e instanceof ApiError && e.status === 409)
        pending.current.delete(signature);
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  };
  async function respond(
    turnId: string,
    text: string,
    kind: string,
    source: string,
  ) {
    if (!state) return;
    setBusy(true);
    try {
      await api.post(
        `/campaigns/${id}/intents/${turnId}/respond`,
        { text, kind, source, expectedRevision: state.revision },
        token,
      );
      setNotice("Resposta registrada e entregue ao autor.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao responder.");
    } finally {
      await load();
      setBusy(false);
    }
  }
  async function cancel(turnId: string) {
    setBusy(true);
    try {
      await api.post(`/campaigns/${id}/intents/${turnId}/cancel`, {}, token);
      setNotice("Intenção cancelada. O histórico foi preservado.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao cancelar.");
    } finally {
      await load();
      setBusy(false);
    }
  }
  function renderTurn(turn: Turn) {
    return (
      <article key={turn.id} className={card} data-intent-id={turn.id}>
        <div className="flex flex-wrap justify-between gap-2">
          <h3 className="font-heading text-xl">
            {turn.character}
            {turn.npc ? ` → ${turn.npc}` : " → Mestre"}
          </h3>
          <span className="text-sm text-muted-foreground">
            {statuses[turn.status] ?? turn.status}
          </span>
        </div>
        {turn.parentTurnId && (
          <p className="mt-1 text-xs text-muted-foreground">
            Continuação da conversa
          </p>
        )}
        <p className="mt-3 whitespace-pre-wrap break-words">{turn.prompt}</p>
        {turn.reply && (
          <div className="mt-4 rounded-lg border-l-2 border-primary bg-muted/30 p-3">
            <p className="mb-1 text-xs text-muted-foreground">
              {turn.replyKind === "ASK"
                ? "Esclarecimento pedido pelo mestre"
                : "Resposta aprovada pelo mestre"}
            </p>
            <p className="whitespace-pre-wrap break-words">{turn.reply}</p>
          </div>
        )}
        {!turn.current && turn.canCancel && (
          <p className="mt-3 text-sm text-muted-foreground">
            A cena ou a participação mudou. Cancele esta intenção e envie uma
            nova no estado atual.
          </p>
        )}
        {turn.canReply && <FollowUp turn={turn} busy={busy} send={send} />}
        {state?.master && turn.current && turn.canCancel && !turn.reply && (
          <MasterReply turn={turn} busy={busy} respond={respond} />
        )}
        {turn.canCancel && (
          <Button
            className="mt-3"
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void cancel(turn.id)}
          >
            Cancelar intenção
          </Button>
        )}
      </article>
    );
  }
  const open =
    state?.turns.filter(
      (t) => !["COMMITTED", "CANCELLED"].includes(t.status),
    ) ?? [];
  const history =
    state?.turns.filter((t) => ["COMMITTED", "CANCELLED"].includes(t.status)) ??
    [];
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
      >
        ← Voltar à mesa
      </Link>
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">
          Conversa da aventura
        </p>
        <h1 className="mt-2 font-heading text-3xl">Intenções e diálogos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Diga o que seu personagem tenta fazer ou perguntar. A conversa fica
          entre você e o mestre; uma intenção não executa ações por conta
          própria.
        </p>
      </header>
      {error && (
        <p role="alert" className={card}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={card}>
          {notice}
        </p>
      )}
      {!state && !error && <p role="status">Carregando conversas…</p>}
      {state && (
        <>
          <section className={card}>
            <h2 className="font-heading text-xl">{state.scene.name}</h2>
            {state.master && (
              <p className="mt-2 text-sm text-muted-foreground">
                Você recebe as intenções da mesa e revisa cada resposta.{" "}
                <Link
                  href={`/campaigns/${id}/copilot`}
                  className="text-primary underline"
                >
                  Abrir controles do copiloto
                </Link>
              </p>
            )}
            {state.characters.length ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    data = new FormData(form);
                  if (
                    await send(
                      String(data.get("prompt") ?? ""),
                      String(data.get("character") ?? ""),
                      String(data.get("npc") ?? ""),
                    )
                  )
                    form.reset();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Seu personagem
                    <select
                      aria-label="Seu personagem"
                      name="character"
                      className={field}
                      disabled={busy}
                    >
                      {state.characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Com quem falar
                    <select
                      aria-label="Com quem falar"
                      name="npc"
                      className={field}
                      disabled={busy}
                    >
                      <option value="">Mestre / cena atual</option>
                      {state.npcs.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  O que seu personagem faz?
                  <textarea
                    aria-label="O que seu personagem faz?"
                    name="prompt"
                    className={field}
                    required
                    maxLength={1500}
                    rows={3}
                    disabled={busy}
                    placeholder="Descreva sua intenção ou pergunta…"
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  Enviar intenção
                </Button>
              </form>
            ) : (
              !state.master && (
                <p className="mt-3 text-sm">
                  Vincule um personagem seu ao cenário para enviar intenções.{" "}
                  <Link
                    className="text-primary underline"
                    href={`/campaigns/${id}/lore`}
                  >
                    Abrir cenário
                  </Link>
                </p>
              )
            )}
          </section>
          <section className="space-y-4" aria-label="Conversas em andamento">
            <h2 className="font-heading text-2xl">Em andamento</h2>
            {open.length ? (
              open.map(renderTurn)
            ) : (
              <p className={card}>Nenhuma intenção pendente.</p>
            )}
          </section>
          {!!history.length && (
            <section className="space-y-4" aria-label="Histórico de conversas">
              <h2 className="font-heading text-2xl">Histórico recente</h2>
              {history.map(renderTurn)}
            </section>
          )}
        </>
      )}
    </main>
  );
}
export default function Page() {
  const { id } = useParams<{ id: string }>(),
    token = useAuthStore((s) => s.token);
  return (
    <RequireAuth>
      {token && <Intents key={`${id}:${token}`} id={id} token={token} />}
    </RequireAuth>
  );
}
