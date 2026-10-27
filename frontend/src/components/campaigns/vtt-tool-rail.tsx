"use client";

import { BrickWall, CloudFog, Compass, Crosshair, DoorClosed, MapPin, Megaphone, MousePointer2, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";

export type VttTool = "move" | "fog" | "measure" | "marker" | "hotspot" | "ping" | "focus" | "wall" | "door";

const tools = [
  { id: "move", label: "Mover no mapa", icon: MousePointer2, masterOnly: false },
  { id: "measure", label: "Medir distância no mapa", icon: Ruler, masterOnly: false },
  { id: "ping", label: "Apontar no mapa para todos (P)", icon: Crosshair, masterOnly: false },
  { id: "focus", label: "Olhem aqui: levar a visão dos jogadores até um ponto", icon: Megaphone, masterOnly: true },
  { id: "fog", label: "Editar névoa de guerra", icon: CloudFog, masterOnly: true },
  { id: "marker", label: "Adicionar marcador", icon: MapPin, masterOnly: true },
  { id: "wall", label: "Parede: clique perto da borda da célula (ou W A S D na grade)", icon: BrickWall, masterOnly: true },
  { id: "door", label: "Porta: clique perto da borda da célula (ou W A S D na grade)", icon: DoorClosed, masterOnly: true },
  { id: "hotspot", label: "Criar local ou portal no mapa", icon: Compass, masterOnly: true },
] as const;

export function VttToolRail({ tool, isMaster, onToolChange, distance }: {
  tool: VttTool;
  isMaster: boolean;
  onToolChange: (tool: VttTool) => void;
  distance: string | null;
}) {
  return (
    <div className="min-w-0 self-start @3xl:sticky @3xl:top-20">
      <div role="group" aria-label="Ferramentas do mapa" className="flex flex-wrap gap-1 rounded-lg border border-primary/25 bg-background/80 p-1 @3xl:flex-col">
        {tools.filter((item) => isMaster || !item.masterOnly).map((item) => (
          <Button key={item.id} size="icon" className="size-11" variant={tool === item.id ? "default" : "ghost"} title={item.label} aria-label={item.label} aria-pressed={tool === item.id} onClick={() => onToolChange(item.id)}>
            <item.icon className="size-5" />
          </Button>
        ))}
      </div>
      {distance ? <output aria-live="polite" aria-label="Distância medida" className="mt-2 block break-all rounded-md border border-primary/30 bg-primary/10 p-1 text-center text-xs tabular-nums text-primary">{distance}</output> : null}
    </div>
  );
}
