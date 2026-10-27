// Sólidos dos dados (IM-04). Cada dado é definido uma vez por vértices e
// faces; a mesma definição gera a malha 3D e o corpo físico, então o que se vê
// é exatamente o que colide e o que é lido.

export type Vec3 = [number, number, number];

export interface DieShape {
  sides: 4 | 6 | 8 | 10 | 12 | 20;
  vertices: Vec3[];
  /** Polígonos em ordem anti-horária vistos de fora (normal para fora). */
  faces: number[][];
  /** d4 se lê pelo vértice de cima; os demais, pela face de cima. */
  readBy: "face" | "vertex";
}

const PHI = (1 + Math.sqrt(5)) / 2;

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function length(a: Vec3) {
  return Math.sqrt(dot(a, a));
}
export function normalize(a: Vec3): Vec3 {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

/**
 * Ordena os vértices de cada face em volta do centro e orienta a normal para
 * fora. Assim basta informar *quais* vértices formam cada face.
 */
function orientFaces(vertices: Vec3[], faceSets: number[][]): number[][] {
  return faceSets.map((set) => {
    const points = set.map((i) => vertices[i]);
    const center = centroid(points);
    const outward = normalize(center);
    const u = normalize(sub(points[0], center));
    const w = cross(outward, u);
    const sorted = [...set].sort((a, b) => {
      const pa = sub(vertices[a], center);
      const pb = sub(vertices[b], center);
      return Math.atan2(dot(pa, w), dot(pa, u)) - Math.atan2(dot(pb, w), dot(pb, u));
    });
    const n = cross(sub(vertices[sorted[1]], vertices[sorted[0]]), sub(vertices[sorted[2]], vertices[sorted[0]]));
    return dot(n, outward) < 0 ? sorted.reverse() : sorted;
  });
}

/** Escala para que o vértice mais distante fique a `radius` do centro. */
function scaled(vertices: Vec3[], radius: number): Vec3[] {
  const max = Math.max(...vertices.map(length));
  return vertices.map((v) => [(v[0] / max) * radius, (v[1] / max) * radius, (v[2] / max) * radius]);
}

function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const pick = (start: number, acc: number[]) => {
    if (acc.length === k) return void result.push(acc);
    for (let i = start; i < n; i++) pick(i + 1, [...acc, i]);
  };
  pick(0, []);
  return result;
}

function tetrahedron(): DieShape {
  const vertices = scaled([[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]], 1.05);
  return { sides: 4, vertices, faces: orientFaces(vertices, combinations(4, 3)), readBy: "vertex" };
}

function cube(): DieShape {
  const vertices: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vertices.push([x, y, z]);
  const faces: number[][] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      faces.push(vertices.map((v, i) => (v[axis] === sign ? i : -1)).filter((i) => i >= 0));
    }
  }
  const s = scaled(vertices, 0.95);
  return { sides: 6, vertices: s, faces: orientFaces(s, faces), readBy: "face" };
}

function octahedron(): DieShape {
  const vertices: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces: number[][] = [];
  for (const x of [0, 1]) for (const y of [2, 3]) for (const z of [4, 5]) faces.push([x, y, z]);
  const s = scaled(vertices, 1);
  return { sides: 8, vertices: s, faces: orientFaces(s, faces), readBy: "face" };
}

function icosahedronVertices(): Vec3[] {
  const v: Vec3[] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) {
    v.push([0, a, b], [a, b, 0], [b, 0, a]);
  }
  return v;
}

function icosahedron(): DieShape {
  const vertices = icosahedronVertices();
  // Faces = trios de vértices mutuamente vizinhos (aresta = 2).
  const faces = combinations(12, 3).filter(([a, b, c]) =>
    [[a, b], [b, c], [a, c]].every(([i, j]) => Math.abs(length(sub(vertices[i], vertices[j])) - 2) < 1e-6),
  );
  const s = scaled(vertices, 1.08);
  return { sides: 20, vertices: s, faces: orientFaces(s, faces), readBy: "face" };
}

function dodecahedron(): DieShape {
  const r = 1 / PHI;
  const vertices: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vertices.push([x, y, z]);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    vertices.push([0, a * r, b * PHI], [a * r, b * PHI, 0], [a * PHI, 0, b * r]);
  }
  // As normais das faces apontam para os vértices do icosaedro dual, que tem a
  // permutação cíclica oposta: (0, ±φ, ±1), (±φ, ±1, 0), (±1, 0, ±φ).
  const directions: Vec3[] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) {
    directions.push([0, b, a], [b, a, 0], [a, 0, b]);
  }
  const faces = directions.map((direction) => {
    const n = normalize(direction);
    const scores = vertices.map((v, i) => [dot(v, n), i] as const).sort((a, b) => b[0] - a[0]);
    return scores.slice(0, 5).map(([, i]) => i);
  });
  const s = scaled(vertices, 1.08);
  return { sides: 12, vertices: s, faces: orientFaces(s, faces), readBy: "face" };
}

/**
 * Trapezoedro pentagonal (d10). Para as pipas serem planas, o anel alterna
 * altura ±h com h = H·(1 − cos36°)/(1 + cos36°).
 */
function trapezohedron(): DieShape {
  const H = 1;
  const c = Math.cos(Math.PI / 5);
  const h = (H * (1 - c)) / (1 + c);
  const ring: Vec3[] = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5;
    return [Math.cos(angle), i % 2 === 0 ? -h : h, Math.sin(angle)];
  });
  const top = 10;
  const bottom = 11;
  const vertices: Vec3[] = [...ring, [0, H, 0], [0, -H, 0]];
  const faces: number[][] = [];
  for (let k = 0; k < 5; k++) {
    const even = 2 * k;
    faces.push([top, (even + 9) % 10, even, (even + 1) % 10]);
    const odd = 2 * k + 1;
    faces.push([bottom, (odd + 9) % 10, odd, (odd + 1) % 10]);
  }
  const s = scaled(vertices, 1);
  return { sides: 10, vertices: s, faces: orientFaces(s, faces), readBy: "face" };
}

const SHAPES: Record<DieShape["sides"], () => DieShape> = {
  4: tetrahedron,
  6: cube,
  8: octahedron,
  10: trapezohedron,
  12: dodecahedron,
  20: icosahedron,
};

const cache = new Map<number, DieShape>();

export function getDieShape(sides: DieShape["sides"]): DieShape {
  let shape = cache.get(sides);
  if (!shape) {
    shape = SHAPES[sides]();
    cache.set(sides, shape);
  }
  return shape;
}

/** Normal externa de cada face no espaço do dado. */
export function faceNormals(shape: DieShape): Vec3[] {
  return shape.faces.map((face) => {
    const [a, b, c] = face.map((i) => shape.vertices[i]);
    return normalize(cross(sub(b, a), sub(c, a)));
  });
}
