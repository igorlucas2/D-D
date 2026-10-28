"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Users } from "lucide-react";
import { MapStage } from "@/components/campaigns/map-stage";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useLoreMapImage } from "@/lib/use-lore-map-image";
import type { VttMap } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

interface PartyState {
  scene: { name: string } | null;
  characters: Array<{ id: string; name: string }>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function CampaignWorldMap({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const token = useAuthStore((state) => state.token);
  const [maps, setMaps] = useState<VttMap[]>([]);
  const [party, setParty] = useState<PartyState | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    let active = true;
    void Promise.all([
      api.get<VttMap[]>(`/campaigns/${campaignId}/vtt/maps`, token),
      api.get<PartyState>(`/campaigns/${campaignId}/ai-master/state`, token),
    ])
      .then(([nextMaps, nextParty]) => {
        if (!active) return;
        setMaps(nextMaps);
        setParty(nextParty);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId, open, token]);

  const world = useMemo(
    () =>
      maps.find((map) => map.name === "Midgard") ??
      maps.find((map) => !map.parentMapId && map.kind === "REGION") ??
      null,
    [maps],
  );
  const image = useLoreMapImage(world?.imageUrl, token);
  const citySpots = useMemo(
    () => (world?.hotspots ?? []).filter((hotspot) => hotspot.targetMapId),
    [world],
  );
  const sceneName = party?.scene?.name ?? "";
  const sceneSpot =
    citySpots.find(
      (hotspot) =>
        sceneName.includes(hotspot.label) ||
        hotspot.label.includes(sceneName.split(" ").at(-1) ?? ""),
    ) ??
    citySpots.find((hotspot) =>
      sceneName.includes(hotspot.label.split(" ")[0]),
    ) ??
    citySpots[0] ??
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto parchment frame-ornate sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" aria-hidden="true" />
            Mapa-múndi de Midgard
          </DialogTitle>
          <DialogDescription>
            Arraste para navegar e use os controles para ampliar. Os pinos
            mostram as cidades e onde a companhia está.
          </DialogDescription>
        </DialogHeader>

        {world && image ? (
          <MapStage label="Mapa-múndi" aspectRatio={world.width / world.height}>
            <div
              className="relative w-full"
              style={{ aspectRatio: `${world.width} / ${world.height}` }}
            >
              <img
                src={image}
                alt="Mapa-múndi de Midgard"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0">
                {citySpots.map((hotspot) => {
                  const active = !!sceneSpot && sceneSpot.id === hotspot.id;
                  return (
                    <div
                      key={hotspot.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${((hotspot.x + 0.5) / world.width) * 100}%`,
                        top: `${((hotspot.y + 0.5) / world.height) * 100}%`,
                      }}
                    >
                      <span
                        title={hotspot.label}
                        className={`block size-2.5 rounded-full border-2 ${
                          active
                            ? "border-primary bg-primary shadow-[0_0_0_4px_rgba(180,140,70,.25)]"
                            : "border-card bg-rose-700"
                        }`}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-card/90 px-1 py-0.5 text-[9px] leading-none text-foreground shadow">
                        {hotspot.label}
                      </span>
                    </div>
                  );
                })}

                {sceneSpot && party?.characters.length
                  ? party.characters.map((character, index) => {
                      const spread = index * 14;
                      return (
                        <div
                          key={character.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `calc(${((sceneSpot.x + 0.5) / world.width) * 100}% + ${spread}px)`,
                            top: `calc(${((sceneSpot.y + 0.5) / world.height) * 100}% - ${28 + spread}px)`,
                          }}
                        >
                          <span
                            title={character.name}
                            className="grid size-7 place-items-center rounded-full border-2 border-card bg-primary font-heading text-[9px] text-primary-foreground shadow-lg"
                          >
                            {initials(character.name)}
                          </span>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
          </MapStage>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            Carregando o mapa-múndi…
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/60 p-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-700" /> Cidade
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" /> Companhia
            </span>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Users className="size-3" aria-hidden="true" />
            {party?.characters.length ?? 0} personagens
          </Badge>
        </div>

        {sceneName ? (
          <p className="text-xs text-muted-foreground">
            Cena atual: <strong className="text-foreground">{sceneName}</strong>
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
