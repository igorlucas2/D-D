"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { StoryEditor } from "@/components/campaigns/story-editor";
import { api, ApiError } from "@/lib/api";
import {
  storyLabels,
  type StoryState,
  type StoryEvents,
} from "@/lib/story-types";
import { useAuthStore } from "@/stores/auth-store";
import { useStoryUpdates } from "@/lib/use-story-updates";
const panel = "rounded-xl border border-border/70 bg-card/80 p-5";
const field =
  "min-h-11 rounded-md border border-border bg-background px-3 py-2 text-sm";
function Memory({ id, token }: { id: string; token: string }) {
  const [data, setData] = useState<StoryState | null>(null);
  const [events, setEvents] = useState<StoryEvents>({
    events: [],
    nextCursor: null,
  });
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [knower, setKnower] = useState("");
  const [history, setHistory] = useState<{
    key: string;
    revisions: {
      id: string;
      version: number;
      text: string;
      event: { summary: string };
    }[];
  } | null>(null);
  const version = useRef(0);
  const active = useRef(true);
  const depth = useRef(1);
  const loadingOlder = useRef(false);
  const reload = useCallback(async () => {
    const request = ++version.current;
    async function timelinePages() {
      const result: StoryEvents = { events: [], nextCursor: null };
      for (let page = 0; page < depth.current; page++) {
        const query = new URLSearchParams({ q: q.trim() });
        if (result.nextCursor) query.set("before", result.nextCursor);
        const next = await api.get<StoryEvents>(
          `/campaigns/${id}/story/events?${query}`,
          token,
        );
        result.events.push(...next.events);
        result.nextCursor = next.nextCursor;
        if (!next.nextCursor) break;
      }
      return result;
    }
    try {
      const [state, timeline] = await Promise.all([
        api.get<StoryState>(`/campaigns/${id}/story/state`, token),
        timelinePages(),
      ]);
      if (!active.current || request !== version.current) return;
      setData(state);
      setEvents(timeline);
      setError("");
    } catch (e) {
      if (!active.current || request !== version.current) return;
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar a memória.",
      );
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
        setData(null);
        setEvents({ events: [], nextCursor: null });
        setHistory(null);
      }
    }
  }, [id, token, q]);
  useStoryUpdates(id, token, reload);
  useEffect(() => {
    active.current = true;
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    void Promise.resolve().then(reload);
    const timer = setInterval(refresh, 10000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active.current = false;
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);
  const match = (text: string) =>
    text
      .toLocaleLowerCase("pt-BR")
      .includes(q.trim().toLocaleLowerCase("pt-BR"));
  async function initialize() {
    try {
      await api.post(`/campaigns/${id}/story/initialize`, {}, token);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar memória.");
    }
  }
  async function showHistory(factId: string) {
    try {
      setHistory(
        await api.get(`/campaigns/${id}/story/facts/${factId}/history`, token),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler histórico.");
    }
  }
  async function older() {
    const cursor = events.nextCursor;
    if (!cursor || loadingOlder.current) return;
    loadingOlder.current = true;
    const request = version.current;
    try {
      const page = await api.get<StoryEvents>(
        `/campaigns/${id}/story/events?before=${encodeURIComponent(cursor)}&q=${encodeURIComponent(q.trim())}`,
        token,
      );
      if (!active.current || request !== version.current) return;
      depth.current++;
      setEvents((current) => ({
        events: [
          ...new Map(
            [...current.events, ...page.events].map((e) => [e.id, e]),
          ).values(),
        ],
        nextCursor: page.nextCursor,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler acontecimentos.");
    } finally {
      loadingOlder.current = false;
    }
  }
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary"
      >
        ← Voltar à mesa
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">
            História da campanha
          </p>
          <h1 className="mt-2 font-heading text-3xl">Memórias</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data?.master
              ? "Acontecimentos, fatos e o que cada personagem sabe."
              : "Informações compartilhadas e descobertas dos seus personagens."}
          </p>
        </div>
        <Button variant="outline" onClick={() => void reload()}>
          Atualizar memória
        </Button>
      </header>
      {error && (
        <p className={panel} role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Consultando a história…</p>}
      {data && !data.installed && (
        <p className={panel}>
          Esta campanha ainda não possui um cenário instalado.
        </p>
      )}
      {data?.installed && !data.initialized && (
        <section className={panel}>
          <p>A memória deste cenário ainda não foi preparada.</p>
          {data.master && (
            <Button className="mt-3" onClick={() => void initialize()}>
              Preparar memória do cenário
            </Button>
          )}
        </section>
      )}
      {data?.initialized && (
        <>
          {data.master && (
            <StoryEditor
              data={data}
              campaignId={id}
              token={token}
              onSaved={reload}
            />
          )}
          <label className="block text-sm">
            Buscar nas informações visíveis
            <input
              type="search"
              className={`${field} mt-1 block w-full`}
              value={q}
              onChange={(e) => {
                depth.current = 1;
                setQ(e.target.value);
              }}
              placeholder="Lugar, pista ou promessa"
              maxLength={80}
            />
          </label>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="font-heading text-xl">Fatos e rumores</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Informação pública permite leitura; não cria automaticamente uma
                descoberta para cada personagem.
              </p>
              <div className="mt-4 space-y-3">
                {data.facts
                  .filter((f) => match(f.text))
                  .map((f) => (
                    <article
                      key={f.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <p className="text-xs text-primary">
                        {storyLabels[f.kind]}
                        {data.master &&
                          ` · ${f.key} · versão ${f.version} · ${storyLabels[f.audience!]}`}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {f.text}
                      </p>
                      {data.master && (
                        <button
                          className="mt-2 min-h-9 text-xs text-primary hover:underline"
                          onClick={() => void showHistory(f.id)}
                        >
                          Ver versões de {f.key}
                        </button>
                      )}
                    </article>
                  ))}
                {!data.facts.some((f) => match(f.text)) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma informação encontrada.
                  </p>
                )}
              </div>
            </section>
            <section className={panel}>
              <h2 className="font-heading text-xl">
                Conhecimento dos personagens
              </h2>
              <label className="mt-3 block text-sm">
                Consultar personagem
                <select
                  aria-label="Consultar personagem"
                  className={`${field} mt-1 block w-full`}
                  value={knower}
                  onChange={(e) => setKnower(e.target.value)}
                >
                  <option value="">Todos disponíveis</option>
                  {(data.master
                    ? data.entities?.filter((e) =>
                        ["NPC", "CHARACTER"].includes(e.kind),
                      )
                    : data.characters
                  )?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 space-y-3">
                {data.knowledge
                  .filter(
                    (k) => (!knower || k.knowerId === knower) && match(k.text),
                  )
                  .map((k) => (
                    <article
                      key={k.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <p className="text-sm font-semibold">
                        {k.knowerName} · {storyLabels[k.stance]}
                      </p>
                      <p className="mt-1 text-sm">{k.text}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Origem: {k.source}
                      </p>
                      {k.stale && (
                        <p className="mt-2 text-xs text-amber-400">
                          Conhecimento de uma versão anterior; ainda não recebeu
                          a mudança.
                        </p>
                      )}
                    </article>
                  ))}
                {!data.knowledge.some(
                  (k) => (!knower || k.knowerId === knower) && match(k.text),
                ) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma descoberta registrada para esta consulta.
                  </p>
                )}
              </div>
            </section>
          </div>
          {history && data.master && (
            <section className={panel}>
              <div className="flex justify-between gap-3">
                <h2 className="font-heading text-xl">
                  Versões de {history.key}
                </h2>
                <Button variant="ghost" onClick={() => setHistory(null)}>
                  Fechar versões
                </Button>
              </div>
              {history.revisions.map((r) => (
                <article
                  key={r.id}
                  className="mt-3 border-t border-border pt-3"
                >
                  <p className="text-xs text-primary">Versão {r.version}</p>
                  <p className="mt-1 text-sm">{r.text}</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                    Registro de origem: {r.event.summary}
                  </p>
                </article>
              ))}
            </section>
          )}
          <div className="grid gap-5 lg:grid-cols-3">
            <section className={panel}>
              <h2 className="font-heading text-xl">Promessas</h2>
              {data.promises
                .filter((p) => match(p.terms))
                .map((p) => (
                  <article key={p.id} className="mt-4 text-sm">
                    <p className="font-semibold">
                      {p.giver} → {p.receiver}
                    </p>
                    <p>{p.terms}</p>
                    <p className="mt-1 text-xs text-primary">
                      {storyLabels[p.status]}
                    </p>
                    {p.resolution && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.resolution}
                      </p>
                    )}
                  </article>
                ))}
              {!data.promises.some((p) => match(p.terms)) && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhuma promessa nesta consulta.
                </p>
              )}
            </section>
            <section className={panel}>
              <h2 className="font-heading text-xl">Fios narrativos</h2>
              {data.threads
                .filter((t) => match(t.objective))
                .map((t) => (
                  <article key={t.id} className="mt-4 text-sm">
                    <p className="font-semibold">{t.objective}</p>
                    <p className="text-xs text-primary">
                      {storyLabels[t.status]}
                    </p>
                    {t.completion && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.completion}
                      </p>
                    )}
                    {t.resolution && <p className="mt-1">{t.resolution}</p>}
                  </article>
                ))}
              {!data.threads.some((t) => match(t.objective)) && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhum fio nesta consulta.
                </p>
              )}
            </section>
            <section className={panel}>
              <h2 className="font-heading text-xl">Relações</h2>
              {data.relationships
                .filter((r) => match(r.description))
                .map((r) => (
                  <article key={r.id} className="mt-4 text-sm">
                    <p className="font-semibold">
                      {r.from} → {r.to}
                    </p>
                    <p>{r.description}</p>
                    {data.master && (
                      <p className="text-xs text-muted-foreground">
                        Confiança {r.trust} · Medo {r.fear}
                      </p>
                    )}
                  </article>
                ))}
            </section>
          </div>
          <section className={panel}>
            <h2 className="font-heading text-xl">Acontecimentos</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Mais recentes primeiro. O histórico preserva o que foi registrado
              na época.
            </p>
            <div className="mt-4 space-y-3">
              {events.events
                .filter((e) => match(e.summary))
                .map((e) => (
                  <article
                    key={e.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-xs text-primary">
                      {storyLabels[e.kind]}
                      {data.master && ` · #${e.sequence} · ${e.actorName}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {e.summary}
                    </p>
                    <time
                      className="mt-2 block text-xs text-muted-foreground"
                      dateTime={e.recordedAt}
                    >
                      {new Date(e.recordedAt).toLocaleString("pt-BR")}
                    </time>
                  </article>
                ))}
            </div>
            {events.nextCursor && (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void older()}
              >
                Carregar anteriores
              </Button>
            )}
          </section>
        </>
      )}
    </main>
  );
}
export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  return (
    <RequireAuth>
      {token && <Memory key={`${id}:${token}`} id={id} token={token} />}
    </RequireAuth>
  );
}
