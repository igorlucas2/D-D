"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
import { ExplorationHud } from "@/components/campaigns/exploration-hud";
import { VttPanel } from "@/components/campaigns/vtt-panel";
import { WorldClockWidget } from "@/components/campaigns/world-clock-widget";
import { ReturnChronicle } from "@/components/campaigns/return-chronicle";
import { api, ApiError } from "@/lib/api";
import {
  JOURNAL_CATEGORY_LABELS,
  type Campaign,
  type CharacterExplorationState,
  type JournalEntry,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { ArrowLeft, BookOpen, Compass, Map, ScrollText } from "lucide-react";

const RECENT_JOURNAL_ENTRIES = 5;

function ExploreContent() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explorationCharacterId, setExplorationCharacterId] = useState<string | null>(null);
  const [explorationState, setExplorationState] = useState<CharacterExplorationState | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      try {
        const [campaignData, entriesData] = await Promise.all([
          api.get<Campaign>(`/campaigns/${params.id}`, token),
          api.get<JournalEntry[]>(`/campaigns/${params.id}/journal`, token),
        ]);
        if (cancelled) return;
        setCampaign(campaignData);
        setJournalEntries(entriesData.slice(0, RECENT_JOURNAL_ENTRIES));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erro ao carregar a exploração.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, params.id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-destructive">
        {error ?? "Campanha não encontrada."}
      </div>
    );
  }

  const isMaster = campaign.masterId === userId;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-6 px-3 py-6 sm:px-6 sm:py-8 xl:px-8">
      <header className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/90 px-4 py-5 shadow-xl shadow-black/20 sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(91,115,83,0.18),transparent_55%)]" />
        <div className="relative">
          <Link
            href={`/campaigns/${campaign.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Voltar à campanha
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {campaign.name}
              </p>
              <h1 className="flex items-center gap-3 text-2xl font-semibold text-foreground sm:text-3xl">
                <Compass className="size-7 shrink-0 text-primary" aria-hidden="true" /> Exploração
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Mapa, jornada e acontecimentos da campanha em um só lugar.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/40 px-3 py-1 text-xs uppercase tracking-widest text-primary">
              {isMaster ? "Mestre" : "Jogador"}
            </Badge>
          </div>
          <nav aria-label="Seções da campanha" className="mt-6 flex max-w-full gap-1 overflow-x-auto border-t border-border/70 pt-3">
            <Link href={`/campaigns/${campaign.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Map className="size-4" aria-hidden="true" /> Mesa
            </Link>
            <Link href={`/campaigns/${campaign.id}/explore`} aria-current="page" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border-b-2 border-primary bg-primary/10 px-3 text-sm font-semibold text-foreground">
              <Compass className="size-4" aria-hidden="true" /> Exploração
            </Link>
            <Link href={`/campaigns/${campaign.id}/world`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <BookOpen className="size-4" aria-hidden="true" /> Mundo
            </Link>
            <Link href={`/campaigns/${campaign.id}/journal`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <ScrollText className="size-4" aria-hidden="true" /> Diário
            </Link>
          </nav>
        </div>
      </header>

      <ReturnChronicle campaignId={campaign.id} />

      <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Mapa e cena da campanha" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Palco da jornada</p>
              <h2 className="font-heading text-xl text-foreground">Mapa da exploração</h2>
            </div>
            <p className="text-xs text-muted-foreground">O mapa ocupa a largura disponível da mesa.</p>
          </div>
          <VttPanel
            campaignId={campaign.id}
            isMaster={isMaster}
            explorationCharacterId={explorationCharacterId}
            explorationState={explorationState}
            onExplorationStateChange={setExplorationState}
          />
        </section>

        <section aria-labelledby="exploration-support-title" className="min-w-0">
          <div className="mb-3 px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ao redor da mesa</p>
            <h2 id="exploration-support-title" className="font-heading text-xl text-foreground">Jornada e registros</h2>
          </div>
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-1">
              <WorldClockWidget campaignId={campaign.id} isMaster={isMaster} />
              <ExplorationHud
                campaignId={campaign.id}
                characterId={explorationCharacterId}
                state={explorationState}
                onCharacterChange={setExplorationCharacterId}
                onStateChange={setExplorationState}
              />
            </div>

            <Card className="h-fit border border-primary/20 bg-card/95">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" aria-hidden="true" /> Diário recente
                </CardTitle>
                <CardDescription>Últimos eventos registrados na campanha.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {journalEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
                ) : (
                  journalEntries.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-1 rounded-lg border border-border/70 bg-background/35 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{entry.title}</span>
                        <Badge variant="outline">{JOURNAL_CATEGORY_LABELS[entry.category]}</Badge>
                      </div>
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {entry.content}
                      </p>
                    </div>
                  ))
                )}
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/campaigns/${campaign.id}/journal`} />}
                >
                  Ver diário completo
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <RequireAuth>
      <ExploreContent />
    </RequireAuth>
  );
}
