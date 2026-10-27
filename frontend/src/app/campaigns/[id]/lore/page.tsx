"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, ShieldCheck } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import type { LorePreview, PublicLorePack } from "@/lib/lore-types";
import { useAuthStore } from "@/stores/auth-store";
import { InstalledLoreReview,type InstalledLore } from "@/components/campaigns/installed-lore-review";

const panel = "rounded-xl border border-border/70 bg-card/80 p-5 sm:p-6";
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Não foi possível carregar o cenário.";

function Preview({ campaignId, token, pack }: { campaignId: string; token: string; pack: PublicLorePack }) {
  const [result, setResult] = useState<{ data?: LorePreview; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const [installError,setInstallError] = useState("");
  const [installing,setInstalling] = useState(false);
  useEffect(() => {
    let active = true;
    api.post<LorePreview>(`/campaigns/${campaignId}/lore/install-preview`, { packId: pack.packId, version: pack.version }, token)
      .then(data => { if (active) setResult({ data }); })
      .catch(e => { if (active) setResult({ error: errorMessage(e) }); });
    return () => { active = false; };
  }, [campaignId, token, pack.packId, pack.version, attempt]);
  if (result.error) return <div className={panel}><p role="alert">{result.error}</p><Button className="mt-3" variant="outline" onClick={() => { setResult({}); setAttempt(a => a + 1); }}>Tentar novamente</Button></div>;
  if (!result.data) return <p role="status" className="py-8 text-muted-foreground">Conferindo cenário e fichas do catálogo…</p>;
  const p = result.data;
  async function install(){setInstalling(true);setInstallError("");try{await api.post(`/campaigns/${campaignId}/lore/install`,{packId:pack.packId,version:pack.version,expectedHash:p.pack.contentHash,allowDraft:pack.status==="DRAFT"},token);window.location.reload();}catch(e){setInstallError(errorMessage(e));setInstalling(false);}}
  const names = Object.fromEntries([...p.review.entities.places, ...p.review.entities.npcs].map(e => [e.id, e.name]));
  const counts = [["NPCs", p.counts.npcs], ["Lugares", p.counts.places], ["Mapas", p.counts.maps], ["Fios narrativos", p.counts.threads]];
  return <div className="space-y-5">
    <section className={panel} aria-labelledby="review-status">
      <h2 id="review-status" className="flex items-center gap-2 font-heading text-xl"><ShieldCheck className="size-5 text-primary" aria-hidden="true" /> Revisão do mestre</h2>
      <p className="mt-2 text-sm text-muted-foreground">Esta leitura contém segredos. Ela não revela informações aos personagens nem instala o cenário na campanha.</p>
      <p className="mt-3 font-medium">{p.validation.catalogValid ? "Todas as fichas foram encontradas no catálogo." : "Há fichas pendentes de correção."}</p>
      {p.validation.conflicts.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-destructive">{p.validation.conflicts.map(c => <li key={c.code + c.message}>{c.message}</li>)}</ul>}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{p.validation.warnings.map(w => <li key={w}>{w}</li>)}</ul>
      {(p.validation.canInstall || p.validation.canInstallPlaytest) && <Button className="mt-4" disabled={installing} onClick={install}>{installing?"Instalando…":p.validation.canInstallPlaytest?"Instalar rascunho de teste":"Instalar cenário"}</Button>}
      {installError && <p role="alert" className="mt-3 text-sm text-destructive">{installError}</p>}
    </section>
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{counts.map(([label, value]) => <div key={label} className={panel}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-heading text-3xl text-primary">{value}</dd></div>)}</dl>
    <section className={panel}><h2 className="font-heading text-xl">Elenco e conhecimento</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{p.review.entities.npcs.map(npc => <article key={npc.id} className="space-y-2 rounded-lg border border-border/60 p-4">
      <h3 className="font-heading text-lg text-primary">{npc.name}</h3><p className="text-xs text-muted-foreground">{names[npc.placeId]} · Ficha: {p.bindings.find(b => b.kind === "NPC" && b.entityId === npc.id)?.name ?? "pendente"}</p>
      <p className="text-sm"><strong>Objetivo:</strong> {npc.objective}</p><p className="text-sm"><strong>Voz:</strong> {npc.voice}</p><p className="text-sm"><strong>O que sabe:</strong> {npc.knowledgeBoundary}</p>
    </article>)}</div></section>
    <details className={panel}><summary className="cursor-pointer font-heading text-xl">Cânone e segredos da história</summary><div className="mt-4 space-y-4">{p.review.facts.facts.map(f => <article key={f.id}><p className="text-xs font-semibold text-primary">{f.id} · {f.audience === "PUBLIC" ? "Público" : "Segredo do mestre"} · {f.mutability === "FIXED" ? "Fato fixo" : "Estado inicial"}</p><p className="mt-1 text-sm">{f.text}</p></article>)}</div></details>
    <details className={panel}><summary className="cursor-pointer font-heading text-xl">Pistas e objetivos</summary><div className="mt-4 grid gap-5 lg:grid-cols-2">{p.review.threads.threads.map(t => <article key={t.id}><h3 className="font-semibold text-primary">{t.objective}</h3><p className="mt-1 text-sm">{t.completion}</p><p className="mt-1 text-sm text-muted-foreground">{t.consequence}</p></article>)}</div><div className="mt-6 space-y-4">{p.review.threads.clues.map(c => <article key={c.id}><h3 className="font-semibold">{c.conclusion}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{c.alternatives.map(a => <li key={a.holderId}>{names[a.holderId]}: {a.text}</li>)}</ul></article>)}</div></details>
    <details className={panel}><summary className="cursor-pointer font-heading text-xl">Mapas, lugares e caminhos</summary><div className="mt-4 grid gap-3 sm:grid-cols-3">{p.review.atlas.maps.map(m => <article key={m.id} className="rounded-lg border border-border/60 p-4"><h3 className="font-semibold">{m.name}</h3><p className="mt-2 text-sm text-muted-foreground">Grade {m.width} × {m.height}</p><p className="text-sm">{m.visibility === "PUBLIC_AT_START" ? "Conhecido na abertura" : "Planta disponível após descoberta"}</p></article>)}</div><ul className="mt-4 space-y-2 text-sm">{p.review.atlas.routes.map(r => <li key={r.from + r.to}>{names[r.from]} ↔ {names[r.to]}: {r.minutes} minutos de jogo</li>)}</ul><p className="mt-3 text-sm text-muted-foreground">Os mapas são esquemáticos. Abrir um mapa não desloca o grupo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{p.review.entities.places.map(l => <p key={l.id} className="text-sm"><strong>{l.name}:</strong> {l.description}</p>)}</div></details>
    <details className={panel}><summary className="cursor-pointer font-heading text-xl">Passado, pressões e reparos</summary><div className="mt-4 space-y-3">{p.review.history.map(h => <p key={h.id} className="text-sm"><strong>{h.timeLabel}:</strong> {h.text}</p>)}</div><div className="mt-6 space-y-4">{p.review.threads.pressures.map(clock => <article key={clock.id}><h3 className="font-semibold text-primary">{clock.afterMinutes} min {clock.afterEventId ? `após ${clock.afterEventId}` : "após a abertura"}</h3><p className="text-sm">{clock.condition}</p><p className="text-sm text-muted-foreground">{clock.effect}</p></article>)}</div><div className="mt-6 space-y-3">{p.review.threads.repairs.map(r => <p key={r.id} className="text-sm"><strong>{names[r.placeId]} · {r.minutes} min:</strong> {r.effect} {r.conditions.join(" ")}</p>)}</div><ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{p.review.threads.guidance.map(g => <li key={g}>{g}</li>)}</ul></details>
    <details className={panel}><summary className="cursor-pointer font-heading text-xl">Facções e encontros</summary><div className="mt-4 space-y-4">{p.review.entities.factions.map(f => <article key={f.id}><h3 className="font-semibold text-primary">{f.name}</h3><p className="text-sm">{f.objective} {f.limits}</p></article>)}</div><div className="mt-6 space-y-3">{p.review.encounters.map(e => <p key={e.id} className="text-sm"><strong>{p.bindings.find(b => b.kind === "CREATURE" && b.entityId === e.id)?.name ?? e.id} · {e.placeId ? names[e.placeId] : "Arco posterior"}:</strong> {e.usage}</p>)}</div><p className="mt-4 text-sm text-muted-foreground">Combates conduzidos pelo mestre; os encontros ainda precisam de teste de equilíbrio.</p></details>
    <details className={panel}><summary className="cursor-pointer font-heading text-xl">Fontes do cenário</summary><ul className="mt-4 space-y-3 text-sm">{p.sources.map(s => <li key={s.reference}>{s.title}<span className="mt-1 block break-all text-xs text-muted-foreground">{s.reference}</span></li>)}</ul></details>
  </div>;
}

function LoreContent({ id, userId, token }: { id: string; userId: string; token: string }) {
  const [state, setState] = useState<{ campaign?: Campaign; packs?: PublicLorePack[]; installed?:InstalledLore; error?: string }>({});
  const [selected, setSelected] = useState<PublicLorePack | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const campaign = await api.get<Campaign>(`/campaigns/${id}`, token);
        if (campaign.masterId !== userId) throw new Error("Esta área é reservada ao mestre da campanha.");
        const installed = await api.get<InstalledLore|{installed:false}>(`/campaigns/${id}/lore/state`,token);
        if(installed.installed){if(active)setState({campaign,packs:[],installed});return;}
        const packs = await api.get<PublicLorePack[]>("/lore-packs", token);
        if (active) setState({ campaign, packs });
      } catch (e) { if (active) setState({ error: errorMessage(e) }); }
    }
    void load();
    return () => { active = false; };
  }, [id, token, userId, attempt]);
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <Link href={`/campaigns/${id}`} className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden="true" /> Voltar à mesa</Link>
    <header><p className="flex items-center gap-2 text-sm text-primary"><BookOpen className="size-4" aria-hidden="true" /> Caderno do mestre</p><h1 className="mt-2 font-heading text-3xl">Cenário da aventura</h1><p className="mt-2 text-muted-foreground">{state.campaign?.name ?? "Preparação da campanha"}</p></header>
    {state.error ? <div className={panel}><p role="alert">{state.error}</p><Button variant="outline" className="mt-3" onClick={() => { setState({}); setAttempt(a => a + 1); }}>Tentar novamente</Button></div> : !state.packs ? <p role="status">Carregando cenários…</p> : <>
      {state.installed && <InstalledLoreReview data={state.installed} campaignId={id} token={token}/>}
      {!state.installed && state.packs.length === 0 && <p>Nenhum cenário está disponível.</p>}
      {state.packs.map(pack => <section key={pack.packId + pack.version} className={panel}><p className="text-xs font-semibold uppercase tracking-widest text-primary">{pack.status === "DRAFT" ? "Rascunho para revisão" : "Publicado"} · {pack.version}</p><h2 className="mt-2 font-heading text-2xl">{pack.title}</h2><p className="mt-2 text-sm text-muted-foreground">{pack.party.minPlayers}–{pack.party.maxPlayers} jogadores · níveis {pack.party.startLevel}–{pack.party.endLevel}</p><p className="mt-4 font-narrative text-lg leading-relaxed">{pack.premise}</p><Button className="mt-5" onClick={() => setSelected(pack)} disabled={selected?.packId === pack.packId && selected.version === pack.version}>Revisar cenário</Button></section>)}
      {selected && <Preview key={selected.packId + selected.version} campaignId={id} token={token} pack={selected} />}
    </>}
  </main>;
}

export default function LorePage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore(s => s.token);
  const userId = useAuthStore(s => s.user?.id);
  return <RequireAuth>{token && userId && <LoreContent key={`${id}:${userId}:${token}`} id={id} userId={userId} token={token} />}</RequireAuth>;
}
