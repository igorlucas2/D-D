"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useStoryUpdates } from "@/lib/use-story-updates";
import { useAuthStore } from "@/stores/auth-store";
type Operation = {
  kind: string;
  routeId?: string;
  type?: string;
  objectId?: string;
  carrierId?: string;
  visibility?: string;
  minutes?: number;
  reason?: string;
};
interface State {
  installed: boolean;
  ready: boolean;
  master: boolean;
  revision?: number;
  scene: { placeId: string; placeName: string; revision: number };
  clock: {
    day: number;
    month: number;
    year: number;
    hour: number;
    minute: number;
    totalMinutes: number;
  };
  participants: { id: string; name: string; own: boolean }[];
  routes: {
    id: string;
    name: string;
    minutes: number;
    blocked: boolean;
    published: boolean;
  }[];
  objects?: {
    id: string;
    name: string;
    placeId: string;
    placeName: string;
    portable: boolean;
    carrierId: string | null;
    containerId: string | null;
  }[];
  actions: {
    id: string;
    requestedBy: string;
    own: boolean;
    status: string;
    operation: Operation;
    stale: boolean;
    decisionReason: string | null;
    eventId: string | null;
  }[];
}
const card = "rounded-xl border border-border/70 bg-card/80 p-5";
const field =
  "mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const statusNames: Record<string, string> = {
  PENDING: "Aguardando mestre",
  COMMITTED: "Aplicada",
  CANCELLED: "Cancelada",
  REJECTED: "Recusada",
};
function Commands({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState("TRAVEL");
  const [busy, setBusy] = useState(false);
  const active = useRef(true),
    version = useRef(0);
  const pending = useRef<{
    signature: string;
    body: Record<string, unknown>;
  } | null>(null);
  const load = useCallback(async () => {
    const seq = ++version.current;
    try {
      const data = await api.get<State>(
        `/campaigns/${id}/game-actions/state`,
        token,
      );
      if (active.current && seq === version.current) {
        setState(data);
        setError("");
      }
    } catch (e) {
      if (active.current && seq === version.current) {
        setError(e instanceof Error ? e.message : "Falha ao consultar a cena.");
        if (e instanceof ApiError && [401, 403, 404].includes(e.status))
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
  const objects = state?.objects ?? [];
  const label = (op: Operation) => {
    if (op.kind === "TRAVEL") {
      const r = state?.routes.find((r) => r.id === op.routeId);
      return r
        ? `Viajar para ${r.name} · ${r.minutes} min`
        : "Viagem pela rota solicitada";
    }
    if (op.kind === "REST")
      return `Descanso ${op.type === "LONG" ? "longo · 8 horas" : "curto · 1 hora"}`;
    if (op.kind === "ADVANCE_TIME")
      return `Avançar ${op.minutes} minutos · ${op.reason}`;
    return `${op.kind === "TAKE_OBJECT" ? "Carregar" : "Deixar"} ${objects.find((o) => o.id === op.objectId)?.name ?? "objeto"}${op.carrierId ? ` com ${state?.participants.find((p) => p.id === op.carrierId)?.name ?? "portador"}` : ""}`;
  };
  async function propose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state) return;
    setBusy(true);
    setNotice("");
    const form = e.currentTarget,
      f = new FormData(form),
      get = (key: string) => String(f.get(key) ?? "");
    const operation: Operation = { kind };
    if (kind === "TRAVEL") operation.routeId = get("routeId");
    if (kind === "REST") operation.type = get("type");
    if (kind === "TAKE_OBJECT" || kind === "DROP_OBJECT") {
      operation.objectId = get("objectId");
      operation.visibility = get("visibility");
    }
    if (kind === "TAKE_OBJECT") operation.carrierId = get("carrierId");
    if (kind === "ADVANCE_TIME") {
      operation.minutes = Number(get("minutes"));
      operation.reason = get("reason").trim();
    }
    const signature = JSON.stringify([kind, [...f.entries()]]);
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        body: {
          requestKey: crypto.randomUUID(),
          expectedSceneRevision: state.scene.revision,
          ...(get("character") ? { characterEntityId: get("character") } : {}),
          operation,
        },
      };
    try {
      await api.post(
        `/campaigns/${id}/game-actions`,
        pending.current.body,
        token,
      );
      pending.current = null;
      setNotice(
        "Solicitação registrada. Os efeitos aguardam confirmação do mestre.",
      );
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao registrar.");
      if (e instanceof ApiError && e.status === 409) {
        pending.current = null;
        await load();
      }
    } finally {
      setBusy(false);
    }
  }
  async function resolve(
    actionId: string,
    decision: "COMMIT" | "CANCEL" | "REJECT",
  ) {
    if (!state) return;
    setBusy(true);
    setNotice("");
    try {
      await api.post(
        `/campaigns/${id}/game-actions/${actionId}/resolve`,
        {
          decision,
          ...(decision === "COMMIT"
            ? { expectedRevision: state.revision }
            : {
                reason:
                  decision === "CANCEL"
                    ? "Solicitação cancelada."
                    : "Ação recusada pelo mestre.",
              }),
        },
        token,
      );
      setNotice(
        decision === "COMMIT"
          ? "Ação aplicada e registrada no histórico."
          : "Solicitação encerrada.",
      );
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao resolver ação.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function initialize() {
    setBusy(true);
    try {
      await api.post(`/campaigns/${id}/game-actions/initialize`, {}, token);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao preparar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
      >
        ← Voltar à mesa
      </Link>
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">
          Ações da campanha
        </p>
        <h1 className="mt-2 font-heading text-3xl">Comandos do grupo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          As ações são propostas e confirmadas pelo mestre. O tempo passa uma
          vez para todo o grupo.
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
      {!state && !error && <p role="status">Consultando a cena…</p>}
      {state && !state.installed && (
        <p className={card}>Instale um cenário para usar comandos de grupo.</p>
      )}
      {state?.installed && !state.ready && (
        <section className={card}>
          <p>Os comandos deste cenário precisam de preparação.</p>
          {state.master && (
            <Button
              className="mt-3"
              disabled={busy}
              onClick={() => void initialize()}
            >
              Preparar comandos do cenário
            </Button>
          )}
        </section>
      )}
      {state?.ready && (
        <>
          <section className={card}>
            <h2 className="font-heading text-xl">{state.scene.placeName}</h2>
            <p className="mt-2 text-primary" data-testid="group-clock">
              Dia {state.clock.day}/{state.clock.month}/{state.clock.year} ·{" "}
              {String(state.clock.hour).padStart(2, "0")}:
              {String(state.clock.minute).padStart(2, "0")}
            </p>
            <p className="mt-2 text-sm">
              {state.participants.map((p) => p.name).join(", ") ||
                "Nenhum personagem na cena."}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void load()}
            >
              Atualizar cena
            </Button>
          </section>
          <section className={card}>
            <h2 className="font-heading text-xl">
              {state.master ? "Preparar ação" : "Solicitar ação"}
            </h2>
            <label className="mt-4 block text-sm">
              Ação
              <select
                aria-label="Ação"
                className={field}
                value={kind}
                disabled={busy}
                onChange={(e) => {
                  setKind(e.target.value);
                  setNotice("");
                }}
              >
                <option value="TRAVEL">Viajar com o grupo</option>
                <option value="REST">Descansar em grupo</option>
                {state.master && (
                  <>
                    <option value="TAKE_OBJECT">
                      Carregar objeto de trama
                    </option>
                    <option value="DROP_OBJECT">Deixar objeto no lugar</option>
                    <option value="ADVANCE_TIME">Avançar tempo da cena</option>
                  </>
                )}
              </select>
            </label>
            <form key={kind} onSubmit={propose} className="mt-4 space-y-4">
              <fieldset disabled={busy} className="space-y-4">
                {!state.master && (
                  <label className="block text-sm">
                    Seu personagem
                    <select
                      aria-label="Seu personagem"
                      className={field}
                      name="character"
                      required
                      defaultValue=""
                    >
                      <option value="">Selecione</option>
                      {state.participants
                        .filter((p) => p.own)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {kind === "TRAVEL" && (
                  <label className="block text-sm">
                    Destino
                    <select
                      aria-label="Destino"
                      className={field}
                      name="routeId"
                      defaultValue=""
                      required
                    >
                      <option value="">Escolha uma rota</option>
                      {state.routes.map((r) => (
                        <option
                          key={r.id}
                          value={r.id}
                          disabled={r.blocked || !r.published}
                        >
                          {r.name} · {r.minutes} min
                          {r.blocked
                            ? " · bloqueada"
                            : !r.published
                              ? " · mapa não publicado"
                              : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {kind === "REST" && (
                  <>
                    <label className="block text-sm">
                      Duração
                      <select
                        aria-label="Duração"
                        className={field}
                        name="type"
                      >
                        <option value="SHORT">Curto · 60 minutos</option>
                        <option value="LONG">Longo · 480 minutos</option>
                      </select>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Curto recupera ações e reduz fadiga. Longo também recupera
                      PV e espaços de magia. Não pode ocorrer durante combate.
                    </p>
                  </>
                )}
                {(kind === "TAKE_OBJECT" || kind === "DROP_OBJECT") && (
                  <>
                    <label className="block text-sm">
                      Objeto
                      <select
                        aria-label="Objeto"
                        className={field}
                        name="objectId"
                        defaultValue=""
                        required
                      >
                        <option value="">Selecione</option>
                        {objects
                          .filter(
                            (o) =>
                              o.portable &&
                              !o.containerId &&
                              o.placeId === state.scene.placeId &&
                              (kind === "TAKE_OBJECT"
                                ? !o.carrierId
                                : !!o.carrierId),
                          )
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {kind === "TAKE_OBJECT" && (
                      <label className="block text-sm">
                        Portador
                        <select
                          aria-label="Portador"
                          className={field}
                          name="carrierId"
                          defaultValue=""
                          required
                        >
                          <option value="">Selecione</option>
                          {state.participants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="block text-sm">
                      Quem pode ler o acontecimento
                      <select
                        aria-label="Quem pode ler o acontecimento"
                        className={field}
                        name="visibility"
                      >
                        <option value="MASTER">Somente o mestre</option>
                        <option value="PUBLIC">Toda a mesa</option>
                      </select>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Recipientes transportam seu conteúdo junto. Descobertas
                      dos personagens são registradas em Memórias.
                    </p>
                  </>
                )}
                {kind === "ADVANCE_TIME" && (
                  <>
                    <label className="block text-sm">
                      Minutos
                      <input
                        name="minutes"
                        type="number"
                        min={1}
                        max={1440}
                        required
                        className={field}
                      />
                    </label>
                    <label className="block text-sm">
                      O que ocorreu nesse tempo?
                      <textarea
                        name="reason"
                        maxLength={1000}
                        required
                        className={field}
                      />
                    </label>
                  </>
                )}
                <Button type="submit" disabled={!state.participants.length}>
                  {busy
                    ? "Registrando…"
                    : state.master
                      ? "Preparar ação"
                      : "Enviar solicitação"}
                </Button>
              </fieldset>
            </form>
          </section>
          <section className={card}>
            <h2 className="font-heading text-xl">Solicitações</h2>
            <div className="mt-4 space-y-3">
              {state.actions.map((a) => (
                <article
                  key={a.id}
                  className="rounded-lg border border-border p-4"
                >
                  <p className="font-semibold">{label(a.operation)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.requestedBy} · {statusNames[a.status]}
                    {"visibility" in a.operation &&
                      ` · ${a.operation.visibility === "MASTER" ? "Reservado ao mestre" : "Compartilhado com a mesa"}`}
                  </p>
                  {a.status === "PENDING" && (
                    <>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {a.stale
                          ? "A cena mudou. Cancele esta solicitação e prepare outra."
                          : "O mestre confirma as condições e o efeito sobre o grupo inteiro."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {state.master && (
                          <>
                            <Button
                              disabled={busy || a.stale}
                              onClick={() => void resolve(a.id, "COMMIT")}
                            >
                              Confirmar ação
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => void resolve(a.id, "REJECT")}
                            >
                              Recusar
                            </Button>
                          </>
                        )}
                        {(a.own || state.master) && (
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void resolve(a.id, "CANCEL")}
                          >
                            Cancelar solicitação
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                  {a.decisionReason && (
                    <p className="mt-2 text-xs">{a.decisionReason}</p>
                  )}
                </article>
              ))}
              {!state.actions.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma solicitação registrada.
                </p>
              )}
            </div>
          </section>
          {state.master && (
            <details className={card}>
              <summary className="cursor-pointer font-heading text-xl">
                Objetos de trama
              </summary>
              {objects.map((o) => (
                <p key={o.id} className="mt-3 text-sm">
                  <strong>{o.name}</strong> · {o.placeName}
                  {o.containerId
                    ? ` · dentro de ${objects.find((c) => c.id === o.containerId)?.name}`
                    : ""}
                  {o.carrierId
                    ? ` · com ${state.participants.find((p) => p.id === o.carrierId)?.name ?? "portador fora do grupo"}`
                    : ""}
                </p>
              ))}
            </details>
          )}
          <Link
            href={`/campaigns/${id}/story`}
            className="inline-flex min-h-11 items-center text-sm text-primary"
          >
            Abrir Memórias →
          </Link>
        </>
      )}
    </main>
  );
}
export default function ActionsPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  return (
    <RequireAuth>
      {token && <Commands key={`${id}:${token}`} id={id} token={token} />}
    </RequireAuth>
  );
}
