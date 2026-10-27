"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useStoryUpdates } from "@/lib/use-story-updates";
import { useAuthStore } from "@/stores/auth-store";

type Policy = {
  enabled: boolean;
  paused: boolean;
  allowNpcTravel: boolean;
  maxPerAdvance: number;
};
type Item = {
  id: string;
  title: string;
  text: string;
  kind: string;
  status: string;
  dueMinute: number;
  autoApproved: boolean;
  reasonCode: string | null;
  npc: string | null;
  from: string | null;
  to: string | null;
  travelMinutes: number | null;
};
type State = {
  revision: number;
  totalMinutes: number;
  aiPaused: boolean;
  policy: Policy;
  npcs: {
    id: string;
    name: string;
    placeId: string;
    place: string;
    travelling: boolean;
  }[];
  routes: {
    id: string;
    fromId: string;
    to: string;
    minutes: number;
    blocked: boolean;
  }[];
  items: Item[];
};
type Mutate = (
  path: string,
  body: Record<string, unknown>,
  method?: "post" | "patch",
) => Promise<boolean>;
const card = "rounded-xl border border-border/70 bg-card/80 p-5";
const field =
  "mt-2 block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const reasons: Record<string, string> = {
  DISABLED: "A execução automática estava desligada.",
  PAUSED: "A execução estava pausada.",
  AUTHORIZATION_CHANGED: "O responsável pela autorização mudou.",
  APPROVAL_REQUIRED: "Este prazo precisa da sua confirmação.",
  OVERDUE: "O prazo já havia passado; revise o estado atual.",
  TRAVEL_DISABLED: "Viagens automáticas estavam desligadas.",
  BUDGET: "O limite de efeitos deste avanço foi atingido.",
  ROUTE_CHANGED: "A rota foi bloqueada ou alterada.",
  NPC_UNAVAILABLE: "O NPC está ferido ou sob uma condição que impede a viagem.",
  NPC_MOVED: "O NPC mudou de lugar.",
  JOURNEY_CHANGED: "A viagem registrada mudou.",
  NPC_CHANGED: "O estado do NPC mudou desde a autorização.",
  COMBAT: "Há um combate em andamento.",
  GROUP_PRESENT:
    "O grupo está no local; confirme a interação antes de mover o NPC.",
  CONVERSATION_PENDING: "Há uma conversa pendente com este NPC.",
};
const statuses: Record<string, string> = {
  SCHEDULED: "Programado",
  WAITING_MASTER: "Aguardando o mestre",
  APPLIED: "Aplicado",
  CANCELLED: "Cancelado",
};
const kinds: Record<string, string> = {
  REMINDER: "Lembrete privado",
  NPC_DEPART: "Partida de NPC",
  NPC_ARRIVE: "Chegada de NPC",
};

function PolicyForm({
  policy,
  busy,
  mutate,
}: {
  policy: Policy;
  busy: boolean;
  mutate: Mutate;
}) {
  return (
    <form
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void mutate(
          "/policy",
          {
            enabled: f.has("enabled"),
            paused: f.has("paused"),
            allowNpcTravel: f.has("travel"),
            maxPerAdvance: Number(f.get("limit")),
          },
          "patch",
        );
      }}
    >
      <h2 className="font-heading text-xl">Permissões do mundo</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cada prazo também precisa de autorização própria. Retomar a execução não
        aplica prazos vencidos.
      </p>
      <fieldset disabled={busy} className="mt-4 space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={policy.enabled}
          />{" "}
          Executar prazos autorizados
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="paused" defaultChecked={policy.paused} />{" "}
          Pausar execução de prazos
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="travel"
            defaultChecked={policy.allowNpcTravel}
          />{" "}
          Permitir viagens de NPCs
        </label>
        <label className="block text-sm">
          Efeitos por avanço de tempo
          <input
            aria-label="Efeitos por avanço de tempo"
            className={field}
            name="limit"
            type="number"
            min={1}
            max={12}
            required
            defaultValue={policy.maxPerAdvance}
          />
        </label>
        <Button type="submit">Salvar permissões</Button>
      </fieldset>
    </form>
  );
}
function ScheduleForm({
  state,
  busy,
  mutate,
}: {
  state: State;
  busy: boolean;
  mutate: Mutate;
}) {
  const [kind, setKind] = useState("REMINDER"),
    [npcId, setNpcId] = useState("");
  const npc = state.npcs.find((n) => n.id === npcId);
  const requests = useRef(new Map<string, string>());
  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          f = new FormData(form);
        const body = {
          kind,
          title: String(f.get("title")),
          text: String(f.get("text") ?? ""),
          delayMinutes: Number(f.get("delay")),
          autoApproved: f.has("auto"),
          ...(kind === "NPC_DEPART"
            ? { npcEntityId: npcId, routeId: String(f.get("route")) }
            : {}),
        };
        const signature = JSON.stringify(body);
        if (!requests.current.has(signature))
          requests.current.set(signature, crypto.randomUUID());
        if (
          await mutate("", {
            ...body,
            requestKey: requests.current.get(signature),
          })
        ) {
          requests.current.delete(signature);
          form.reset();
          setKind("REMINDER");
          setNpcId("");
        }
      }}
    >
      <h2 className="font-heading text-xl">Novo prazo</h2>
      <fieldset disabled={busy} className="mt-4 space-y-3">
        <label className="block text-sm">
          Tipo
          <select
            aria-label="Tipo"
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="REMINDER">Lembrete privado</option>
            <option value="NPC_DEPART">Viagem de NPC</option>
          </select>
        </label>
        <label className="block text-sm">
          Título
          <input
            aria-label="Título"
            className={field}
            name="title"
            required
            maxLength={120}
          />
        </label>
        {kind === "REMINDER" ? (
          <label className="block text-sm">
            O que revisar
            <textarea
              aria-label="O que revisar"
              className={field}
              name="text"
              maxLength={2000}
              rows={3}
            />
          </label>
        ) : (
          <>
            <label className="block text-sm">
              NPC
              <select
                aria-label="NPC"
                className={field}
                value={npcId}
                onChange={(e) => setNpcId(e.target.value)}
                required
              >
                <option value="">Selecione um NPC</option>
                {state.npcs
                  .filter((n) => !n.travelling)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} — {n.place}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              Rota
              <select
                aria-label="Rota"
                key={npcId}
                className={field}
                name="route"
                required
                defaultValue=""
              >
                <option value="">Selecione o destino</option>
                {state.routes
                  .filter((r) => r.fromId === npc?.placeId && !r.blocked)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.to} · {r.minutes} min
                    </option>
                  ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              A partida cria uma chegada separada. Durante o trajeto, o NPC fica
              indisponível para conversar. A viagem não transporta objetos.
            </p>
          </>
        )}
        <label className="block text-sm">
          Começar daqui a quantos minutos de jogo?
          <input
            aria-label="Minutos até o prazo"
            className={field}
            type="number"
            name="delay"
            min={1}
            max={43200}
            defaultValue={60}
            required
          />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input className="mt-1" type="checkbox" name="auto" /> Autorizar
          execução automática deste prazo e da chegada, se as condições
          continuarem válidas
        </label>
        <Button type="submit">Preparar prazo</Button>
      </fieldset>
    </form>
  );
}
function Deadline({
  item,
  now,
  busy,
  mutate,
}: {
  item: Item;
  now: number;
  busy: boolean;
  mutate: Mutate;
}) {
  const pending = ["SCHEDULED", "WAITING_MASTER"].includes(item.status),
    delta = item.dueMinute - now;
  return (
    <article className={card} aria-label={item.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {kinds[item.kind]}
        </span>
        <span className="text-sm text-primary">{statuses[item.status]}</span>
      </div>
      <h3 className="mt-2 break-words font-heading text-xl">{item.title}</h3>
      {item.npc && (
        <p className="mt-2 text-sm">
          {item.npc} · De {item.from} para {item.to} · {item.travelMinutes} min
          de viagem
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {delta > 0
          ? `Em ${delta} minutos de jogo`
          : delta === 0
            ? "Prazo alcançado"
            : `Prazo há ${-delta} minutos de jogo`}{" "}
        · {item.autoApproved ? "Execução autorizada" : "Confirmação manual"}
      </p>
      {item.text && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">
          {item.text}
        </p>
      )}
      {item.reasonCode && (
        <p className="mt-3 text-sm text-amber-300">
          {reasons[item.reasonCode] ?? "Revise as condições atuais."}
        </p>
      )}
      {pending && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={busy || delta > 0}
              onClick={() =>
                void mutate(`/${item.id}/resolve`, { decision: "APPLY" })
              }
            >
              Aplicar agora
            </Button>
            {item.kind !== "NPC_ARRIVE" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void mutate(`/${item.id}/resolve`, { decision: "CANCEL" })
                }
              >
                Cancelar prazo
              </Button>
            )}
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer">
              Adiar e revisar autorização
            </summary>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void mutate(`/${item.id}/postpone`, {
                  delayMinutes: Number(f.get("delay")),
                  autoApproved: f.has("auto"),
                });
              }}
            >
              <fieldset disabled={busy} className="space-y-3">
                <label className="block">
                  Novo prazo a partir de agora (minutos)
                  <input
                    aria-label="Novo prazo a partir de agora"
                    className={field}
                    name="delay"
                    type="number"
                    min={Math.max(1, delta + 1)}
                    max={43200}
                    defaultValue={Math.max(60, delta + 60)}
                    required
                  />
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="auto"
                    defaultChecked={item.autoApproved}
                  />{" "}
                  Autorizar execução no novo prazo
                </label>
                <Button type="submit" variant="outline">
                  Salvar adiamento
                </Button>
              </fieldset>
            </form>
          </details>
        </>
      )}
    </article>
  );
}
function Consequences({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef(true),
    sequence = useRef(0),
    writing = useRef(false);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const s = await api.get<State>(`/campaigns/${id}/consequences`, token);
      if (active.current && seq === sequence.current) setState(s);
    } catch (e) {
      if (active.current && seq === sequence.current) {
        setError(
          e instanceof Error ? e.message : "Falha ao carregar os prazos.",
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
    const timer = setInterval(refresh, 5000);
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
  const mutate: Mutate = async (path, body, method = "post") => {
    if (!state || writing.current) return false;
    writing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api[method](
        `/campaigns/${id}/consequences${path}`,
        { ...body, expectedRevision: state.revision },
        token,
      );
      await load();
      setNotice("Prazos atualizados.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar os prazos.");
      await load();
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link
        className="text-sm text-muted-foreground hover:text-foreground"
        href={`/campaigns/${id}`}
      >
        ← Voltar à campanha
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl">Prazos do mundo</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Lembretes e viagens acompanham o relógio do jogo, mesmo com o Gemma
            desligado. Apenas o mestre vê esta cronologia.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setError("");
            void load();
          }}
        >
          Atualizar prazos
        </Button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/50 p-4 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
      {state && (
        <>
          <div className={card}>
            <p className="font-medium">
              {!state.policy.enabled
                ? "Execução automática desligada"
                : state.policy.paused || state.aiPaused
                  ? "Execução automática pausada"
                  : "Execução automática habilitada"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              O tempo avança em Comandos do grupo. Prazos vencidos durante pausa
              ou sem autorização aguardam sua revisão.
            </p>
            {state.aiPaused && (
              <p className="mt-2 text-sm text-amber-300">
                A pausa geral no Copiloto também interrompe os prazos
                automáticos.
              </p>
            )}
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <PolicyForm
              key={JSON.stringify(state.policy)}
              policy={state.policy}
              busy={busy}
              mutate={mutate}
            />
            <ScheduleForm state={state} busy={busy} mutate={mutate} />
          </div>
          <section className={card}>
            <h2 className="font-heading text-xl">
              Marcos do Pacto dos Três Sinos
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Prepare seis lembretes da lore: caixote, ponte, galeria, Conselho
              e Bento. Eles pedem revisão; não movem carga, fecham a ponte nem
              causam dano.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              disabled={busy}
              onClick={() => void mutate("/preset", { autoApproved: false })}
            >
              Preparar lembretes da lore
            </Button>
          </section>
          {state.npcs.some((n) => n.travelling) && (
            <section className={card}>
              <h2 className="font-heading text-xl">Em viagem</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {state.npcs
                  .filter((n) => n.travelling)
                  .map((n) => (
                    <li key={n.id}>
                      {n.name} · partiu de {n.place}
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <section className="space-y-4" aria-label="Prazos pendentes">
            <h2 className="font-heading text-2xl">
              Próximos passos e revisões
            </h2>
            {state.items
              .filter((i) => ["SCHEDULED", "WAITING_MASTER"].includes(i.status))
              .map((i) => (
                <Deadline
                  key={i.id}
                  item={i}
                  now={state.totalMinutes}
                  busy={busy}
                  mutate={mutate}
                />
              ))}
            {!state.items.some((i) =>
              ["SCHEDULED", "WAITING_MASTER"].includes(i.status),
            ) && (
              <p className="text-muted-foreground">
                Nenhum prazo pendente. Prepare um lembrete ou uma viagem.
              </p>
            )}
          </section>
          {state.items.some((i) =>
            ["APPLIED", "CANCELLED"].includes(i.status),
          ) && (
            <section className="space-y-4" aria-label="Histórico de prazos">
              <h2 className="font-heading text-2xl">Histórico recente</h2>
              {state.items
                .filter((i) => ["APPLIED", "CANCELLED"].includes(i.status))
                .map((i) => (
                  <Deadline
                    key={i.id}
                    item={i}
                    now={state.totalMinutes}
                    busy={busy}
                    mutate={mutate}
                  />
                ))}
            </section>
          )}
          <nav className="flex flex-wrap gap-6 text-sm text-primary">
            <Link href={`/campaigns/${id}/actions`}>
              Abrir Comandos do grupo →
            </Link>
            <Link href={`/campaigns/${id}/story`}>Abrir Memórias →</Link>
            <Link href={`/campaigns/${id}/copilot`}>Abrir Copiloto →</Link>
          </nav>
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
      {token && <Consequences key={`${id}:${token}`} id={id} token={token} />}
    </RequireAuth>
  );
}
