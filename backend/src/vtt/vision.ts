// Visão dinâmica (IM-13): o que o grupo enxerga num mapa, calculado no
// servidor. Paredes e portas fechadas ficam nas bordas das células e bloqueiam
// a linha de visão; no escuro, só se vê o que uma luz ilumina ou o que a visão
// no escuro de quem olha alcança.

export type VisionMode = 'OFF' | 'LIT' | 'DARK';

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Ausente = parede; porta aberta não bloqueia. */
  door?: 'open' | 'closed';
}

export interface VisionSource {
  x: number;
  y: number;
  size: number;
  lightRadius: number;
  visionRadius: number;
}

const MAX_WALLS = 2000;

/** Aceita só segmentos de uma célula, alinhados à grade e dentro do mapa. */
export function sanitizeWalls(
  input: unknown,
  width: number,
  height: number,
): Wall[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const walls: Wall[] = [];
  for (const raw of input.slice(0, MAX_WALLS)) {
    if (!raw || typeof raw !== 'object') continue;
    const { x1, y1, x2, y2, door } = raw as Record<string, unknown>;
    if (![x1, y1, x2, y2].every((v) => Number.isInteger(v))) continue;
    const [a, b, c, d] = [x1, y1, x2, y2] as number[];
    const horizontal = b === d && Math.abs(a - c) === 1;
    const vertical = a === c && Math.abs(b - d) === 1;
    if (!horizontal && !vertical) continue;
    if (Math.min(a, c) < 0 || Math.max(a, c) > width) continue;
    if (Math.min(b, d) < 0 || Math.max(b, d) > height) continue;
    // Normaliza a direção para que a mesma borda tenha uma só chave.
    const wall: Wall = {
      x1: Math.min(a, c),
      y1: Math.min(b, d),
      x2: Math.max(a, c),
      y2: Math.max(b, d),
    };
    if (door === 'open' || door === 'closed') wall.door = door;
    const key = wallKey(wall);
    if (seen.has(key)) continue;
    seen.add(key);
    walls.push(wall);
  }
  return walls;
}

export function wallKey(wall: Wall) {
  return `${wall.x1}:${wall.y1}:${wall.x2}:${wall.y2}`;
}

/** O raio de (ox,oy) a (tx,ty) cruza alguma parede bloqueante? */
function blocked(
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  walls: Wall[],
): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const EPS = 1e-9;
  for (const wall of walls) {
    if (wall.x1 === wall.x2) {
      // Parede vertical em x = wall.x1, de y1 a y2.
      if (Math.abs(dx) < EPS) continue;
      const t = (wall.x1 - ox) / dx;
      if (t <= EPS || t >= 1 - EPS) continue;
      const y = oy + t * dy;
      // Extremos inclusivos: não dá para espiar pela quina entre duas paredes.
      if (y >= wall.y1 - EPS && y <= wall.y2 + EPS) return true;
    } else {
      if (Math.abs(dy) < EPS) continue;
      const t = (wall.y1 - oy) / dy;
      if (t <= EPS || t >= 1 - EPS) continue;
      const x = ox + t * dx;
      if (x >= wall.x1 - EPS && x <= wall.x2 + EPS) return true;
    }
  }
  return false;
}

// Centro e quatro pontos internos: a célula aparece se qualquer um for visível.
const SAMPLES: [number, number][] = [
  [0.5, 0.5],
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
];

function seesCell(
  ox: number,
  oy: number,
  cx: number,
  cy: number,
  walls: Wall[],
) {
  return SAMPLES.some(([sx, sy]) => !blocked(ox, oy, cx + sx, cy + sy, walls));
}

function center(source: VisionSource): [number, number] {
  return [source.x + source.size / 2, source.y + source.size / 2];
}

function occupies(source: VisionSource, x: number, y: number) {
  return (
    x >= source.x &&
    x < source.x + source.size &&
    y >= source.y &&
    y < source.y + source.size
  );
}

/**
 * Células que o grupo vê. `viewers` são os tokens dos jogadores; `lights`, as
 * fontes de luz visíveis (de qualquer token).
 */
export function computeVisibleCells(
  width: number,
  height: number,
  mode: VisionMode,
  walls: Wall[],
  viewers: VisionSource[],
  lights: VisionSource[],
): Set<string> {
  const visible = new Set<string>();
  if (mode === 'OFF') {
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) visible.add(`${x}:${y}`);
    return visible;
  }
  const blocking = walls.filter((wall) => wall.door !== 'open');

  // No escuro: o que alguma luz alcança (com linha de visão a partir da luz).
  const lit = new Set<string>();
  if (mode === 'DARK') {
    for (const light of lights) {
      if (light.lightRadius <= 0) continue;
      const [lx, ly] = center(light);
      const r = light.lightRadius + light.size / 2;
      for (
        let y = Math.max(0, Math.floor(ly - r));
        y < Math.min(height, Math.ceil(ly + r));
        y++
      ) {
        for (
          let x = Math.max(0, Math.floor(lx - r));
          x < Math.min(width, Math.ceil(lx + r));
          x++
        ) {
          if (Math.hypot(x + 0.5 - lx, y + 0.5 - ly) > r) continue;
          if (occupies(light, x, y) || seesCell(lx, ly, x, y, blocking))
            lit.add(`${x}:${y}`);
        }
      }
    }
  }

  for (const viewer of viewers) {
    const [vx, vy] = center(viewer);
    const darkvision = viewer.visionRadius + viewer.size / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x}:${y}`;
        if (visible.has(key)) continue;
        if (occupies(viewer, x, y)) {
          visible.add(key);
          continue;
        }
        if (mode === 'DARK') {
          const nearEnough =
            viewer.visionRadius > 0 &&
            Math.hypot(x + 0.5 - vx, y + 0.5 - vy) <= darkvision;
          if (!lit.has(key) && !nearEnough) continue;
        }
        if (seesCell(vx, vy, x, y, blocking)) visible.add(key);
      }
    }
  }
  return visible;
}

/** Paredes que tocam alguma célula visível (o resto do traçado não vaza). */
export function visibleWalls(walls: Wall[], visible: Set<string>): Wall[] {
  return walls.filter((wall) => {
    const cells =
      wall.x1 === wall.x2
        ? [`${wall.x1 - 1}:${wall.y1}`, `${wall.x1}:${wall.y1}`]
        : [`${wall.x1}:${wall.y1 - 1}`, `${wall.x1}:${wall.y1}`];
    return cells.some((cell) => visible.has(cell));
  });
}
