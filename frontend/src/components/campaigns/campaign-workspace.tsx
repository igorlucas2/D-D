"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Map,
  ScrollText,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { CampaignPartyWidget } from "@/components/campaigns/campaign-party-widget";
import { CampaignTableDock } from "@/components/campaigns/campaign-table-dock";
import { CampaignWorldMap } from "@/components/campaigns/campaign-world-map";
import { CombatPanel } from "@/components/campaigns/combat-panel";
import { ExplorationHud } from "@/components/campaigns/exploration-hud";
import { LoreScenePanel } from "@/components/campaigns/lore-scene-panel";
import { ReturnChronicle } from "@/components/campaigns/return-chronicle";
import { VttPanel } from "@/components/campaigns/vtt-panel";
import { WorldClockWidget } from "@/components/campaigns/world-clock-widget";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Campaign, CharacterExplorationState } from "@/lib/types";

type WorkspacePanel =
  "scene" | "chronicle" | "company" | "combat" | "journey" | null;

interface CampaignWorkspaceProps {
  campaign: Campaign;
  isMaster: boolean;
  compact?: boolean;
}

export function CampaignWorkspace({
  campaign,
  isMaster,
  compact = false,
}: CampaignWorkspaceProps) {
  const [panel, setPanel] = useState<WorkspacePanel>(null);
  const [worldOpen, setWorldOpen] = useState(false);
  const [explorationCharacterId, setExplorationCharacterId] = useState<
    string | null
  >(null);
  const [explorationState, setExplorationState] =
    useState<CharacterExplorationState | null>(null);

  return (
    <section aria-label="Mesa de jogo" className="min-w-0 space-y-3">
      <div
        className={
          compact
            ? "hidden"
            : "flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/75 p-2"
        }
      >
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setPanel("scene")}
        >
          <BookOpen className="size-4" aria-hidden="true" /> Cena
        </Button>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setPanel("chronicle")}
        >
          <ScrollText className="size-4" aria-hidden="true" /> Crônica
        </Button>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setPanel("company")}
        >
          <Users className="size-4" aria-hidden="true" /> Companhia
        </Button>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setPanel("combat")}
        >
          <Swords className="size-4" aria-hidden="true" /> Combate
        </Button>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setWorldOpen(true)}
        >
          <Map className="size-4" aria-hidden="true" /> Mapa-múndi
        </Button>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setPanel("journey")}
        >
          <Compass className="size-4" aria-hidden="true" /> Jornada
        </Button>
        <Button
          className="h-10 gap-2"
          nativeButton={false}
          render={<Link href={`/campaigns/${campaign.id}/play`} />}
        >
          <Sparkles className="size-4" aria-hidden="true" /> Mesa narrada
        </Button>
      </div>

      <div className="relative min-w-0 overflow-hidden rounded-xl">
        <CampaignPartyWidget campaignId={campaign.id} mode="map" />
        <VttPanel
          campaignId={campaign.id}
          isMaster={isMaster}
          compact={compact}
          explorationCharacterId={explorationCharacterId}
          explorationState={explorationState}
          onExplorationStateChange={setExplorationState}
        />
      </div>

      <CampaignWorldMap
        campaignId={campaign.id}
        open={worldOpen}
        onOpenChange={setWorldOpen}
      />

      <Dialog
        open={panel === "scene"}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent className="max-h-[88dvh] overflow-y-auto parchment frame-ornate sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cena do grupo</DialogTitle>
            <DialogDescription>
              Onde o grupo está, quem está presente e o vínculo das fichas.
            </DialogDescription>
          </DialogHeader>
          <LoreScenePanel campaignId={campaign.id} />
          <ReturnChronicle campaignId={campaign.id} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={panel === "chronicle"}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent className="max-h-[88dvh] overflow-y-auto parchment frame-ornate sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crônica pública</DialogTitle>
            <DialogDescription>
              Visível para todos os jogadores. O histórico completo fica em
              Memórias.
            </DialogDescription>
          </DialogHeader>
          <CampaignTableDock campaignId={campaign.id} showParty={false} />
          <Button
            variant="outline"
            className="w-full gap-2"
            nativeButton={false}
            render={<Link href={`/campaigns/${campaign.id}/play`} />}
          >
            Abrir mesa narrada{" "}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={panel === "company"}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent className="max-h-[88dvh] overflow-y-auto parchment frame-ornate sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Companhia</DialogTitle>
            <DialogDescription>
              {campaign.members.length} participantes. Clique em um personagem
              para abrir a ficha rápida.
            </DialogDescription>
          </DialogHeader>
          <CampaignTableDock campaignId={campaign.id} showChronicle={false} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={panel === "combat"}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent className="max-h-[88dvh] overflow-y-auto parchment frame-ornate sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Combate</DialogTitle>
            <DialogDescription>
              Iniciativa, PV, condições e ações do encontro ativo.
            </DialogDescription>
          </DialogHeader>
          <CombatPanel campaignId={campaign.id} isMaster={isMaster} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={panel === "journey"}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent className="max-h-[88dvh] overflow-y-auto parchment frame-ornate sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Jornada</DialogTitle>
            <DialogDescription>
              Relógio do mundo, exploração e descanso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <WorldClockWidget campaignId={campaign.id} isMaster={isMaster} />
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
              <BookOpen className="size-4" aria-hidden="true" /> Abrir diário
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
