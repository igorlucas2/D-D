"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useStoryUpdates } from "@/lib/use-story-updates";
import { useAuthStore } from "@/stores/auth-store";
type Proposal = {
  kind: string;
  text: string;
  evidenceIds: string[];
  routeId: string | null;
  restType: string | null;
  revisionId: string | null;
  knowerIds: string[];
  sourceNpcId: string | null;
};
type Turn = {
  id: string;
  kind: string;
  prompt: string;
  status: string;
  proposal: Proposal | null;
  effect: string | null;
  errorCode: string | null;
  eventId: string | null;
  stale: boolean;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string | null;
  sources: { id: string; text: string }[];
};
type State = {
  mode: "OFF" | "COPILOT";
  paused: boolean;
  revision: number;
  npcs: { id: string; name: string }[];
  turns: Turn[];
  provider: { available: boolean; model: string; reason?: string };
};
const card = "rounded-xl border border-border/70 bg-card/80 p-5";
const field =
  "mt-2 block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const statuses: Record<string, string> = {
  REQUESTED: "Na fila",
  GENERATING: "Consultando o modelo local…",
  READY: "Aguardando sua revisão",
  FAILED: "Não foi possível gerar",
  STALE: "A cena mudou",
  CANCELLED: "Cancelado",
  COMMITTED: "Registrado",
};
const errors: Record<string, string> = {
  PROVIDER_UNAVAILABLE:
    "O modelo local não respondeu dentro do prazo. Confira a disponibilidade e envie um novo pedido.",
  INVALID_PROPOSAL:
    "A resposta não passou na validação de formato ou referências. Nenhum efeito foi aplicado.",
  INTERRUPTED:
    "A consulta foi interrompida. Envie um novo pedido para tentar novamente.",
  STATE_CHANGED: "O mundo mudou durante a consulta. Prepare um novo pedido.",
  SETTINGS_CHANGED: "Pedido cancelado ao alterar os controles do copiloto.",
};
function Review({
  turn,
  busy,
  disabled,
  onResolve,
}: {
  turn: Turn;
  busy: boolean;
  disabled: boolean;
  onResolve: (
    id: string,
    decision: "ACCEPT" | "CANCEL",
    text?: string,
    visibility?: string,
  ) => Promise<void>;
}) {
  const [text, setText] = useState(turn.proposal?.text ?? ""),
    [visibility, setVisibility] = useState("MASTER");
  const narrative =
    turn.proposal && ["ANSWER", "ASK"].includes(turn.proposal.kind);
  return (
    <article className={card}>
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{turn.prompt}</h3>
        <span className="text-sm text-primary">{statuses[turn.status]}</span>
      </div>
      {turn.errorCode && (
        <p className="mt-3 text-sm">
          {errors[turn.errorCode] ?? "Consulte novamente antes de aprovar."}
        </p>
      )}
      {turn.proposal && (
        <>
          <p className="mt-3 whitespace-pre-wrap text-sm">
            {turn.proposal.text}
          </p>
          <p className="mt-3 rounded-md border border-primary/30 p-3 text-sm">
            {turn.effect}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {turn.proposal.kind === "TRAVEL"
              ? "Propõe viagem pela rota validada. O tempo só muda ao aprovar."
              : turn.proposal.kind === "REST"
                ? `Propõe descanso ${turn.proposal.restType === "LONG" ? "longo (8 horas)" : "curto (1 hora)"}.`
                : turn.proposal.kind === "DISCOVER"
                  ? "Propõe uma descoberta para os personagens indicados no contexto. Confirme que a conversa realmente aconteceu."
                  : "Rascunho sem efeitos mecânicos. Confira e edite antes de registrar."}
          </p>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer">
              Fontes citadas na resposta
            </summary>
            {turn.sources.map((s) => (
              <p key={s.id} className="mt-2 whitespace-pre-wrap">
                <span className="text-primary">{s.id}</span> · {s.text}
              </p>
            ))}
            {!turn.sources.length && (
              <p className="mt-2">O modelo pediu mais informação.</p>
            )}
          </details>
          {turn.status === "READY" && narrative && (
            <>
              <label className="mt-4 block text-sm">
                Texto revisado
                <textarea
                  aria-label="Texto revisado"
                  className={field}
                  maxLength={2000}
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm">
                Visibilidade
                <select
                  aria-label="Visibilidade"
                  className={field}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="MASTER">Somente o mestre</option>
                  <option value="PUBLIC">Publicar para toda a mesa</option>
                </select>
              </label>
            </>
          )}
        </>
      )}
      {turn.status === "READY" && turn.stale && (
        <p className="mt-3 text-sm">
          A campanha mudou desde esta consulta. Cancele e consulte novamente.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {turn.status === "READY" && (
          <Button
            disabled={
              busy || disabled || turn.stale || (!!narrative && !text.trim())
            }
            onClick={() =>
              void onResolve(
                turn.id,
                "ACCEPT",
                narrative ? text : undefined,
                narrative ? visibility : undefined,
              )
            }
          >
            {narrative ? "Aprovar texto revisado" : "Aprovar efeito no jogo"}
          </Button>
        )}
        {["REQUESTED", "GENERATING", "READY", "STALE", "FAILED"].includes(
          turn.status,
        ) && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void onResolve(turn.id, "CANCEL")}
          >
            Cancelar pedido
          </Button>
        )}
        {turn.eventId && (
          <span className="self-center text-sm text-muted-foreground">
            Resultado disponível em Memórias.
          </span>
        )}
      </div>
      {turn.latencyMs !== null && (
        <p className="mt-3 text-xs text-muted-foreground">
          {(turn.latencyMs / 1000).toFixed(1)} s · {turn.inputTokens ?? 0}{" "}
          tokens de entrada · {turn.outputTokens ?? 0} de saída
        </p>
      )}
    </article>
  );
}
function Copilot({ id, token }: { id: string; token: string }) {
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState("PLAN");
  const userId = useAuthStore((state) => state.user?.id);
  const pending = useRef<{
    signature: string;
    body: Record<string, unknown>;
  } | null>(null);
  const query = useQuery({
    queryKey: ["copilot", userId, id],
    queryFn: ({ signal }) =>
      api.get<State>(`/campaigns/${id}/game-master/state`, token, signal),
    enabled: Boolean(token),
  });
  const state = query.data ?? null;
  const error =
    query.error instanceof ApiError
      ? query.error.message
      : query.error
        ? "Falha ao carregar o copiloto."
        : "";
  useStoryUpdates(id, token, () => {
    void query.refetch();
  });
  async function settings(mode: "OFF" | "COPILOT", paused: boolean) {
    if (!state) return;
    setBusy(true);
    try {
      await api.patch(
        `/campaigns/${id}/game-master/settings`,
        { mode, paused, expectedRevision: state.revision },
        token,
      );
      setNotice("Controles atualizados. Pedidos anteriores foram cancelados.");
      await query.refetch();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao configurar.");
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function ask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state) return;
    setBusy(true);
    setNotice("");
    const f = new FormData(e.currentTarget),
      prompt = String(f.get("prompt") ?? "").trim(),
      focus = String(f.get("focus") ?? "");
    const signature = JSON.stringify([kind, prompt, focus]);
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        body: {
          kind,
          prompt,
          ...(focus ? { focusEntityId: focus } : {}),
          expectedRevision: state.revision,
          requestKey: crypto.randomUUID(),
        },
      };
    try {
      await api.post(
        `/campaigns/${id}/game-master/actions`,
        pending.current.body,
        token,
      );
      pending.current = null;
      setNotice(
        "Pedido salvo. Você pode pausar ou cancelar enquanto o modelo consulta a memória.",
      );
      await query.refetch();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao consultar.");
      if (e instanceof ApiError && e.status === 409) {
        pending.current = null;
        await query.refetch();
      }
    } finally {
      setBusy(false);
    }
  }
  async function resolve(
    turnId: string,
    decision: "ACCEPT" | "CANCEL",
    text?: string,
    visibility?: string,
  ) {
    setBusy(true);
    setNotice("");
    try {
      await api.post(
        `/campaigns/${id}/game-master/turns/${turnId}/resolve`,
        {
          decision,
          ...(text ? { text } : {}),
          ...(visibility ? { visibility } : {}),
        },
        token,
      );
      setNotice(
        decision === "ACCEPT"
          ? "Proposta aprovada e registrada uma única vez."
          : "Pedido cancelado.",
      );
      await query.refetch();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao resolver.");
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  const disabled = !state || state.mode !== "COPILOT" || state.paused;
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <Link
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
        href={`/campaigns/${id}`}
      >
        ← Voltar à mesa
      </Link>
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">
          Caderno do mestre
        </p>
        <h1 className="mt-2 font-heading text-3xl">Mestre copiloto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Consulte a lore e a memória da campanha. Toda resposta fica reservada
          a você até sua revisão; os efeitos precisam de aprovação.
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
      {!state && !error && <p role="status">Carregando o copiloto…</p>}
      {state && (
        <>
          <section className={card}>
            <h2 className="font-heading text-xl">
              {state.mode === "OFF"
                ? "Desligado"
                : state.paused
                  ? "Pausado"
                  : "Copiloto ligado"}
            </h2>
            <p className="mt-2 text-sm">
              {state.provider.available
                ? "Modelo local disponível"
                : "Modelo local indisponível"}{" "}
              · {state.provider.model}
            </p>
            {!state.provider.available && (
              <p className="mt-2 text-sm text-muted-foreground">
                Inicie o Ollama com o modelo configurado. A campanha continua
                disponível para condução humana.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {state.mode === "OFF" ? (
                <Button
                  disabled={busy}
                  onClick={() => void settings("COPILOT", false)}
                >
                  Ligar copiloto
                </Button>
              ) : (
                <>
                  <Button
                    disabled={busy}
                    onClick={() => void settings("COPILOT", !state.paused)}
                  >
                    {state.paused ? "Retomar copiloto" : "Pausar copiloto"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void settings("OFF", false)}
                  >
                    Desligar
                  </Button>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Pausar ou mudar o modo cancela pedidos em andamento e propostas
              ainda não aprovadas. Resultados já registrados permanecem.
            </p>
          </section>
          <section className={card}>
            <h2 className="font-heading text-xl">Consultar a campanha</h2>
            <form onSubmit={ask} className="mt-4 space-y-4">
              <fieldset
                disabled={busy || disabled || !state.provider.available}
                className="space-y-4"
              >
                <label className="block text-sm">
                  Tipo de consulta
                  <select
                    aria-label="Tipo de consulta"
                    className={field}
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="PLAN">
                      Planejar ou consultar fatos privados
                    </option>
                    <option value="NPC">
                      Preparar fala de um NPC presente
                    </option>
                    <option value="PUBLIC">
                      Preparar narração com contexto público
                    </option>
                  </select>
                </label>
                {kind !== "PUBLIC" && (
                  <label className="block text-sm">
                    NPC presente
                    <select
                      key={kind}
                      aria-label="NPC presente"
                      className={field}
                      name="focus"
                      required={kind === "NPC"}
                      defaultValue=""
                    >
                      <option value="">
                        {kind === "NPC"
                          ? "Escolha quem vai falar"
                          : "Sem NPC específico"}
                      </option>
                      {state.npcs.map((n) => (
                        <option value={n.id} key={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-sm">
                  Pedido ao copiloto
                  <textarea
                    aria-label="Pedido ao copiloto"
                    className={field}
                    name="prompt"
                    maxLength={1500}
                    rows={4}
                    required
                    placeholder="O que sabemos sobre o desaparecimento do badajo?"
                  />
                </label>
                <Button type="submit">
                  {busy ? "Salvando…" : "Consultar memória"}
                </Button>
              </fieldset>
            </form>
          </section>
          <section className="space-y-4">
            <h2 className="font-heading text-xl">Pedidos e propostas</h2>
            {state.turns.map((t) => (
              <Review
                key={`${t.id}:${t.status}`}
                turn={t}
                busy={busy}
                disabled={disabled}
                onResolve={resolve}
              />
            ))}
            {!state.turns.length && (
              <p className={card}>Nenhuma consulta nesta campanha.</p>
            )}
          </section>
          <Link
            className="inline-flex min-h-11 items-center text-primary"
            href={`/campaigns/${id}/story`}
          >
            Abrir Memórias →
          </Link>
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
      {token && <Copilot key={`${id}:${token}`} id={id} token={token} />}
    </RequireAuth>
  );
}
