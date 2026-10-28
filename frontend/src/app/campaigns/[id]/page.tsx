"use client";
import { LoreScenePanel } from "@/components/campaigns/lore-scene-panel";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CombatPanel } from "@/components/campaigns/combat-panel";
import { CampaignTableDock } from "@/components/campaigns/campaign-table-dock";
import { CampaignPartyWidget } from "@/components/campaigns/campaign-party-widget";
import { ExplorationHud } from "@/components/campaigns/exploration-hud";
import { VttPanel } from "@/components/campaigns/vtt-panel";
import { WorldClockWidget } from "@/components/campaigns/world-clock-widget";
import { ReturnChronicle } from "@/components/campaigns/return-chronicle";
import { SessionWorkspace } from "@/components/campaigns/session-workspace";
import { api, ApiError } from "@/lib/api";
import type { Campaign, CharacterExplorationState } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Compass,
  Copy,
  Crown,
  Link2,
  Map,
  Maximize2,
  Minimize2,
  Sparkles,
  Swords,
  Users,
  X,
} from "lucide-react";

function CampaignDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    kind: "delete" | "leave" | "member";
    userId?: string;
    name: string;
  } | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [explorationCharacterId, setExplorationCharacterId] = useState<
    string | null
  >(null);
  const [explorationState, setExplorationState] =
    useState<CharacterExplorationState | null>(null);

  async function refresh() {
    if (!token) return;
    const data = await api.get<Campaign>(`/campaigns/${params.id}`, token);
    setCampaign(data);
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadCampaign() {
      try {
        const data = await api.get<Campaign>(`/campaigns/${params.id}`, token);
        if (!cancelled) setCampaign(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Erro ao carregar campanha.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCampaign();

    return () => {
      cancelled = true;
    };
  }, [token, params.id]);

  async function handleCopyInvite() {
    if (!campaign) return;
    try {
      await navigator.clipboard.writeText(campaign.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError(
        "Não foi possível copiar. Selecione o código para copiá-lo manualmente.",
      );
    }
  }

  async function handleLeave() {
    if (!token || !campaign) return;
    await api.delete(`/campaigns/${campaign.id}/members/me`, token);
    router.push("/campaigns");
  }

  async function handleDelete() {
    if (!token || !campaign) return;
    await api.delete(`/campaigns/${campaign.id}`, token);
    router.push("/campaigns");
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!token || !campaign) return;
    await api.delete(
      `/campaigns/${campaign.id}/members/${memberUserId}`,
      token,
    );
    await refresh();
  }

  async function confirmAction() {
    if (!pendingAction || acting) return;
    setActing(true);
    setActionError(null);
    try {
      if (pendingAction.kind === "delete") await handleDelete();
      else if (pendingAction.kind === "leave") await handleLeave();
      else if (pendingAction.userId)
        await handleRemoveMember(pendingAction.userId);
      setPendingAction(null);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setActing(false);
    }
  }

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
    <div
      data-session-focus={focusMode}
      className="mx-auto flex w-full max-w-[1920px] min-w-0 flex-col gap-3 px-3 py-3 sm:px-5 lg:px-6"
    >
      <header className="relative overflow-hidden rounded-xl border border-primary/25 bg-card/90 px-4 py-3 shadow-xl shadow-black/20 sm:px-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/80 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full bg-primary/5 blur-3xl"
        />
        <div className="relative flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href="/campaigns"
              className={`${focusMode ? "hidden" : "inline-flex"} min-h-8 items-center gap-1 text-xs text-muted-foreground hover:text-primary`}
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Todas as
              campanhas
            </Link>
            <p
              className={`${focusMode ? "hidden" : "flex"} items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary`}
            >
              <Crown className="size-4" aria-hidden="true" /> Crônica em
              andamento
            </p>
            <h1 className="break-words font-heading text-2xl leading-tight text-foreground sm:text-3xl">
              {campaign.name}
            </h1>
            {campaign.description && !focusMode ? (
              <details className="max-w-3xl text-sm text-muted-foreground">
                <summary className="w-fit cursor-pointer py-1 hover:text-foreground">
                  Sobre esta aventura
                </summary>
                <p className="font-narrative break-words py-2 text-lg">
                  {campaign.description}
                </p>
              </details>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`${focusMode ? "hidden" : ""} border-primary/40 px-3 py-1 text-primary`}
            >
              {isMaster ? "Você é o mestre" : "Você é jogador"}
            </Badge>
            <Badge
              variant="outline"
              className={`${focusMode ? "hidden" : ""} px-3 py-1`}
            >
              <Users className="mr-1 size-3.5" aria-hidden="true" />{" "}
              {campaign.members.length} na mesa
            </Badge>
            <Button
              variant="outline"
              className="h-11"
              aria-pressed={focusMode}
              onClick={() => setFocusMode((value) => !value)}
            >
              {focusMode ? (
                <Minimize2 className="size-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-4" aria-hidden="true" />
              )}
              {focusMode ? "Visão completa" : "Focar no mapa"}
            </Button>
          </div>
        </div>
      </header>

      {!focusMode && (
        <LoreScenePanel key={campaign.id} campaignId={campaign.id} />
      )}
      <div
        className={`${focusMode ? "hidden" : "flex"} flex-col gap-3 rounded-xl border border-border/70 bg-card/75 p-2 shadow-md shadow-black/15 lg:flex-row lg:items-center lg:justify-between`}
      >
        <nav
          aria-label="Áreas da campanha"
          className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 lg:pb-0"
        >
          <span
            aria-current="page"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-primary/45 bg-primary/15 px-3 text-sm font-semibold text-primary"
          >
            <Map className="size-4" aria-hidden="true" /> Mesa
          </span>
          <Button
            variant="ghost"
            nativeButton={false}
            className="h-9"
            render={<Link href={`/campaigns/${campaign.id}/play`} />}
          >
            <Sparkles className="size-4" aria-hidden="true" /> Mesa narrada
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            className="h-9"
            render={<Link href={`/campaigns/${campaign.id}/explore`} />}
          >
            <Compass className="size-4" aria-hidden="true" /> Exploração
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            className="h-9"
            render={<Link href={`/campaigns/${campaign.id}/journal`} />}
          >
            <BookOpen className="size-4" aria-hidden="true" /> Diário
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            className="h-9"
            render={<Link href={`/campaigns/${campaign.id}/story`} />}
          >
            <BookOpen className="size-4" aria-hidden="true" /> Memórias
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            className="h-9"
            render={<Link href={`/campaigns/${campaign.id}/world`} />}
          >
            <Map className="size-4" aria-hidden="true" /> Mundo
          </Button>
          <span
            aria-hidden="true"
            className="mx-1 h-5 w-px shrink-0 bg-border"
          />
          <Button
            variant="ghost"
            nativeButton={false}
            className="h-9"
            render={<Link href={`/campaigns/${campaign.id}/actions`} />}
          >
            Comandos
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            className="h-9"
            render={<Link href={`/campaigns/${campaign.id}/intents`} />}
          >
            Intenções
          </Button>
          {isMaster && (
            <span className="inline-flex h-9 shrink-0 items-center rounded-md border border-primary/25 bg-primary/5 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Mestre
            </span>
          )}
          {isMaster && (
            <Button
              variant="ghost"
              nativeButton={false}
              className="h-9"
              render={<Link href={`/campaigns/${campaign.id}/copilot`} />}
            >
              Copiloto
            </Button>
          )}
          {isMaster && (
            <Button
              variant="ghost"
              nativeButton={false}
              className="h-9"
              render={<Link href={`/campaigns/${campaign.id}/consequences`} />}
            >
              Prazos
            </Button>
          )}
          {isMaster && (
            <Button
              variant="ghost"
              nativeButton={false}
              className="h-9"
              render={<Link href={`/campaigns/${campaign.id}/lore`} />}
            >
              <BookOpen className="size-4" aria-hidden="true" /> Cenário
            </Button>
          )}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {isMaster ? (
            <Dialog onOpenChange={() => setActionError(null)}>
              <DialogTrigger render={<Button variant="outline" />}>
                <Link2 className="size-4" aria-hidden="true" /> Convidar
              </DialogTrigger>
              <DialogContent className="parchment frame-ornate sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Convite</DialogTitle>
                  <DialogDescription>
                    Compartilhe este código para que outros jogadores entrem na
                    campanha.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
                    {campaign.inviteCode}
                  </code>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={
                      copied ? "Código copiado" : "Copiar código de convite"
                    }
                    onClick={handleCopyInvite}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
                {actionError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {actionError}
                  </p>
                ) : null}
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {actionError && !pendingAction ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      <CampaignTableDock campaignId={campaign.id} showParty={false} />
      <ReturnChronicle campaignId={campaign.id} />

      <SessionWorkspace
        panels={[
          {
            id: "company",
            label: "Companhia",
            icon: Users,
            content: (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {campaign.members.length} participantes na campanha
                </p>
                {campaign.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar className="size-10 shrink-0 ring-1 ring-primary/35">
                        <AvatarFallback>
                          {member.user.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium"
                          title={member.user.displayName}
                        >
                          {member.user.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.role === "MASTER" ? "Mestre" : "Jogador"}
                        </p>
                      </div>
                    </div>
                    {isMaster && member.role !== "MASTER" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-destructive"
                        aria-label={`Remover ${member.user.displayName} da campanha`}
                        onClick={() => {
                          setActionError(null);
                          setPendingAction({
                            kind: "member",
                            userId: member.userId,
                            name: member.user.displayName,
                          });
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Gerenciar participação
                  </p>
                  <Button
                    variant="destructive"
                    className="min-h-11"
                    onClick={() => {
                      setActionError(null);
                      setPendingAction({
                        kind: isMaster ? "delete" : "leave",
                        name: campaign.name,
                      });
                    }}
                  >
                    {isMaster ? "Excluir campanha" : "Sair da campanha"}
                  </Button>
                </div>
              </div>
            ),
          },
          {
            id: "combat",
            label: "Combate",
            icon: Swords,
            content: (
              <CombatPanel campaignId={campaign.id} isMaster={isMaster} />
            ),
          },
          {
            id: "journey",
            label: "Jornada",
            icon: Compass,
            content: (
              <div className="space-y-3">
                <WorldClockWidget
                  campaignId={campaign.id}
                  isMaster={isMaster}
                />
                <ExplorationHud
                  campaignId={campaign.id}
                  characterId={explorationCharacterId}
                  state={explorationState}
                  onCharacterChange={setExplorationCharacterId}
                  onStateChange={setExplorationState}
                />
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  nativeButton={false}
                  render={<Link href={`/campaigns/${campaign.id}/journal`} />}
                >
                  <BookOpen className="size-4" aria-hidden="true" /> Abrir
                  diário
                </Button>
              </div>
            ),
          },
        ]}
      >
        <div className="relative min-w-0">
          <CampaignPartyWidget campaignId={campaign.id} mode="map" />
          <VttPanel
            campaignId={campaign.id}
            isMaster={isMaster}
            compact={focusMode}
            explorationCharacterId={explorationCharacterId}
            explorationState={explorationState}
            onExplorationStateChange={setExplorationState}
          />
        </div>
      </SessionWorkspace>
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !acting) setPendingAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.kind === "delete"
                ? "Excluir campanha?"
                : pendingAction?.kind === "leave"
                  ? "Sair da campanha?"
                  : "Remover participante?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.kind === "delete"
                ? `A campanha “${pendingAction.name}” e seus dados serão excluídos. Esta ação não pode ser desfeita.`
                : pendingAction?.kind === "leave"
                  ? `Você sairá de “${pendingAction.name}”. Será necessário um convite para voltar.`
                  : `${pendingAction?.name ?? "Este participante"} perderá o acesso à campanha.`}
            </DialogDescription>
          </DialogHeader>
          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={acting}
              onClick={() => setPendingAction(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={acting}
              onClick={confirmAction}
            >
              {acting ? "Aguarde..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <RequireAuth>
      <CampaignDetailContent />
    </RequireAuth>
  );
}
