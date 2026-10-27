// Movimento do jogador (MV-07): o servidor confere se o token chega ao
// destino andando pela grade sem atravessar parede ou porta fechada, e se a
// porta que o jogador quer abrir está ao alcance de um token dele.

import { wallKey, type Wall } from './vision';

export interface Footprint {
  x: number;
  y: number;
  size: number;
}

function blockingKeys(walls: Wall[]) {
  return new Set(
    walls.filter((wall) => wall.door !== 'open').map((wall) => wallKey(wall)),
  );
}

const STEPS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** As bordas que um token de lado `size` cruza ao dar um passo. */
function stepEdges(x: number, y: number, size: number, dx: number, dy: number) {
  const edges: string[] = [];
  for (let i = 0; i < size; i += 1) {
    if (dx !== 0) {
      const edgeX = dx > 0 ? x + size : x;
      edges.push(`${edgeX}:${y + i}:${edgeX}:${y + i + 1}`);
    } else {
      const edgeY = dy > 0 ? y + size : y;
      edges.push(`${x + i}:${edgeY}:${x + i + 1}:${edgeY}`);
    }
  }
  return edges;
}

/**
 * Existe caminho (passos ortogonais) de `from` até (toX, toY) dentro do mapa
 * sem cruzar parede ou porta fechada? Não limita a distância: o ritmo do
 * movimento continua sendo combinado à mesa.
 */
export function canReach(
  from: Footprint,
  toX: number,
  toY: number,
  width: number,
  height: number,
  walls: Wall[],
): boolean {
  if (from.x === toX && from.y === toY) return true;
  const blocked = blockingKeys(walls);
  if (blocked.size === 0) return true;
  const maxX = Math.max(0, width - from.size);
  const maxY = Math.max(0, height - from.size);
  const seen = new Set([`${from.x}:${from.y}`]);
  const queue: [number, number][] = [[from.x, from.y]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx > maxX || ny > maxY) continue;
      const key = `${nx}:${ny}`;
      if (seen.has(key)) continue;
      if (stepEdges(x, y, from.size, dx, dy).some((e) => blocked.has(e))) {
        continue;
      }
      if (nx === toX && ny === toY) return true;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

/** O token está encostado (ou a uma célula) de um dos lados da porta? */
export function canReachDoor(token: Footprint, door: Wall): boolean {
  const sides: [number, number][] =
    door.x1 === door.x2
      ? [
          [door.x1 - 1, door.y1],
          [door.x1, door.y1],
        ]
      : [
          [door.x1, door.y1 - 1],
          [door.x1, door.y1],
        ];
  return sides.some(([cx, cy]) => {
    const dx = Math.max(token.x - cx, 0, cx - (token.x + token.size - 1));
    const dy = Math.max(token.y - cy, 0, cy - (token.y + token.size - 1));
    return Math.max(dx, dy) <= 1;
  });
}
