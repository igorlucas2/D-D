"use client";

import type { VttWall } from "@/lib/types";

export type WallEdge = Pick<VttWall, "x1" | "y1" | "x2" | "y2">;

export function wallKey(wall: WallEdge) {
  return `${wall.x1}:${wall.y1}:${wall.x2}:${wall.y2}`;
}

/** Borda da célula (x,y) indicada por lado. */
export function cellEdge(x: number, y: number, side: "top" | "bottom" | "left" | "right"): WallEdge {
  if (side === "top") return { x1: x, y1: y, x2: x + 1, y2: y };
  if (side === "bottom") return { x1: x, y1: y + 1, x2: x + 1, y2: y + 1 };
  if (side === "left") return { x1: x, y1: y, x2: x, y2: y + 1 };
  return { x1: x + 1, y1: y, x2: x + 1, y2: y + 1 };
}

/** Lado da célula mais próximo do ponto clicado (frações 0–1 dentro da célula). */
export function nearestSide(fx: number, fy: number): "top" | "bottom" | "left" | "right" {
  const distances = { top: fy, bottom: 1 - fy, left: fx, right: 1 - fx } as const;
  return (Object.keys(distances) as (keyof typeof distances)[]).reduce((best, side) =>
    distances[side] < distances[best] ? side : best,
  );
}

interface WallsLayerProps {
  walls: VttWall[];
  width: number;
  height: number;
  /** Mestre, ou jogador com token no mapa (o servidor confere a distância). */
  canToggleDoors: boolean;
  onToggleDoor: (wall: VttWall) => void;
  /** Mestre: células que os jogadores não veem agora (prévia da visão). */
  previewHidden: Set<string> | null;
}

// Paredes e portas da visão dinâmica (IM-13), por cima da grade e abaixo dos
// tokens. O mestre abre e fecha qualquer porta; o jogador, as que estão junto
// do personagem dele.
export function WallsLayer({ walls, width, height, canToggleDoors, onToggleDoor, previewHidden }: WallsLayerProps) {
  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[12] h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {previewHidden
          ? [...previewHidden].map((key) => {
              const [x, y] = key.split(":").map(Number);
              return <rect key={key} x={x} y={y} width={1} height={1} fill="rgba(8, 10, 18, 0.62)" />;
            })
          : null}
        {walls.flatMap((wall) => {
          // Porta aberta: só os batentes nas pontas, com o vão livre no meio.
          const segments: [number, number, number, number][] =
            wall.door === "open"
              ? [
                  [wall.x1, wall.y1, wall.x1 + (wall.x2 - wall.x1) * 0.22, wall.y1 + (wall.y2 - wall.y1) * 0.22],
                  [wall.x2 - (wall.x2 - wall.x1) * 0.22, wall.y2 - (wall.y2 - wall.y1) * 0.22, wall.x2, wall.y2],
                ]
              : [[wall.x1, wall.y1, wall.x2, wall.y2]];
          return segments.map(([x1, y1, x2, y2], index) => (
            <line
              key={`${wallKey(wall)}-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={wall.door ? "#b58a50" : "#e6d9b8"}
              strokeWidth={wall.door ? 6 : 4}
              strokeLinecap="square"
              vectorEffect="non-scaling-stroke"
            />
          ));
        })}
      </svg>
      {canToggleDoors
        ? walls
            .filter((wall) => wall.door)
            .map((wall) => {
              const open = wall.door === "open";
              return (
                <button
                  key={`door-${wallKey(wall)}`}
                  type="button"
                  onClick={() => onToggleDoor(wall)}
                  aria-label={`Porta ${open ? "aberta" : "fechada"}: clique para ${open ? "fechar" : "abrir"}`}
                  title={open ? "Porta aberta (clique para fechar)" : "Porta fechada (clique para abrir)"}
                  className={`absolute z-[21] size-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-[var(--rpg-bronze)] ${open ? "bg-transparent" : "bg-[var(--rpg-bronze)]"}`}
                  style={{ left: `${(((wall.x1 + wall.x2) / 2) / width) * 100}%`, top: `${(((wall.y1 + wall.y2) / 2) / height) * 100}%` }}
                />
              );
            })
        : null}
    </>
  );
}
