"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated blob URLs are loaded directly by the browser. */
import { useLoreMapImage } from "@/lib/use-lore-map-image";
import type { LorePreview, PublicLorePack } from "@/lib/lore-types";
import { LoreScenePanel } from "./lore-scene-panel";
import Link from "next/link";

export interface InstalledLore {
  installed: true;
  playtest: boolean;
  mode: string;
  installedHash: string;
  maps: {
    id: string;
    name: string;
    key: string;
    published: boolean;
    imageUrl: string;
  }[];
  entities: {
    id: string;
    key: string;
    kind: string;
    name: string;
    npc: {
      placeEntityId: string;
      currentHp: number;
      maxHp: number;
      objective: string;
      voice: string;
    } | null;
    plotObject: { state: string } | null;
  }[];
  review: LorePreview["review"] & { public: PublicLorePack };
}
function MapPreview({
  map,
  token,
}: {
  map: InstalledLore["maps"][number];
  token: string;
}) {
  const image = useLoreMapImage(map.imageUrl, token);
  return (
    <article className="space-y-2 rounded-lg border border-border p-3">
      <h3 className="font-heading text-lg">{map.name}</h3>
      <p className="text-xs text-muted-foreground">
        {map.published
          ? "Publicado para a mesa"
          : "Reservado ao mestre até publicação"}
      </p>
      {image ? (
        <img
          src={image}
          alt={`Mapa de ${map.name}`}
          className="h-auto w-full rounded"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Carregando mapa protegido…
        </p>
      )}
    </article>
  );
}
export function InstalledLoreReview({
  data,
  campaignId,
  token,
}: {
  data: InstalledLore;
  campaignId: string;
  token: string;
}) {
  const names = Object.fromEntries(data.entities.map((e) => [e.id, e.name]));
  const panel = "rounded-xl border border-border/70 bg-card/80 p-5";
  return (
    <div className="space-y-5">
      <section className={panel}>
        <p className="text-xs uppercase tracking-widest text-primary">
          {data.playtest ? "Cenário instalado para teste" : "Cenário instalado"}{" "}
          · Condução humana
        </p>
        <h2 className="mt-2 font-heading text-2xl">
          {data.review.public.title}
        </h2>
        <p className="mt-3 font-narrative text-lg">
          {data.review.public.premise}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta campanha guarda sua própria cópia do mundo. As premissas abaixo
          são a versão inicial; acontecimentos e descobertas evoluem em
          Memórias.
        </p>
        <Link
          className="mt-3 inline-flex min-h-11 items-center text-sm text-primary hover:underline"
          href={`/campaigns/${campaignId}/story`}
        >
          Abrir memórias da campanha →
        </Link>
      </section>
      <LoreScenePanel campaignId={campaignId} />
      <section className={panel}>
        <h2 className="font-heading text-xl">Mapas instalados</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {data.maps.map((m) => (
            <MapPreview key={m.id} map={m} token={token} />
          ))}
        </div>
      </section>
      <section className={panel}>
        <h2 className="font-heading text-xl">NPCs desta campanha</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {data.entities
            .filter((e) => e.npc)
            .map((e) => (
              <article
                key={e.id}
                className="space-y-2 rounded-lg border border-border/60 p-4"
              >
                <h3 className="font-heading text-lg text-primary">{e.name}</h3>
                <p className="text-sm">
                  {names[e.npc!.placeEntityId]} · PV {e.npc!.currentHp}/
                  {e.npc!.maxHp}
                </p>
                <p className="text-sm">{e.npc!.objective}</p>
                <p className="text-sm text-muted-foreground">{e.npc!.voice}</p>
                <p className="text-sm">
                  {
                    data.review.entities.npcs.find((n) => n.id === e.key)
                      ?.knowledgeBoundary
                  }
                </p>
              </article>
            ))}
        </div>
      </section>
      <details className={panel}>
        <summary className="cursor-pointer font-heading text-xl">
          Cânone e conhecimento inicial
        </summary>
        <div className="mt-4 space-y-3">
          {data.review.facts.facts.map((f) => (
            <p key={f.id} className="text-sm">
              <strong>
                {f.id} · {f.audience === "PUBLIC" ? "Público" : "Segredo"}:
              </strong>{" "}
              {f.text}
            </p>
          ))}
        </div>
      </details>
      <details className={panel}>
        <summary className="cursor-pointer font-heading text-xl">
          Objetivos e pistas
        </summary>
        <div className="mt-4 space-y-3">
          {data.review.threads.threads.map((t) => (
            <p key={t.id} className="text-sm">
              <strong>{t.objective}:</strong> {t.completion}
            </p>
          ))}
          {data.review.threads.clues.map((c) => (
            <article key={c.id}>
              <h3 className="mt-4 font-semibold">{c.conclusion}</h3>
              <ul className="list-disc pl-5 text-sm">
                {c.alternatives.map((a) => (
                  <li key={a.holderId}>{a.text}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </details>
      <details className={panel}>
        <summary className="cursor-pointer font-heading text-xl">
          Passado e pressões preparadas
        </summary>
        <div className="mt-4 space-y-3">
          {data.review.history.map((h) => (
            <p key={h.id} className="text-sm">
              <strong>{h.timeLabel}:</strong> {h.text}
            </p>
          ))}
          {data.review.threads.pressures.map((p) => (
            <p key={p.id} className="text-sm">
              <strong>
                {p.afterMinutes} min{" "}
                {p.afterEventId ? `após ${p.afterEventId}` : "após a abertura"}:
              </strong>{" "}
              {p.condition} {p.effect}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Pressões ainda são conduzidas pelo mestre; nenhum prazo executa
          consequências automaticamente.
        </p>
      </details>
    </div>
  );
}
