import { Body, Plane, Quaternion, Vec3 as CVec3, World, ConvexPolyhedron, Material, ContactMaterial } from "cannon-es";
import { faceNormals, getDieShape, type DieShape, type Vec3 } from "@/lib/dice/polyhedra";

// Rolagem física pré-calculada (IM-04). O servidor já decidiu os valores; aqui
// simulamos o lançamento inteiro antes de exibir, descobrimos qual face (ou
// vértice, no d4) termina para cima e trocamos os rótulos para que ela mostre
// o valor do servidor. A animação é só a reprodução dos quadros gravados.

export const TRAY = { halfWidth: 6, halfDepth: 3.6 };
const STEP = 1 / 60;
const MAX_STEPS = 360;

export interface DieRequest {
  sides: DieShape["sides"];
  /** Rótulo que deve terminar para cima (ex.: "17", "00", "7"). */
  value: string;
  /** Rótulos na ordem padrão (por face, ou por vértice no d4). */
  labels: string[];
}

export interface SimulatedDie {
  sides: DieShape["sides"];
  /** Rótulos já trocados: o elemento de cima recebe `value`. */
  labels: string[];
  value: string;
}

export interface Simulation {
  dice: SimulatedDie[];
  /** frames[f][d] = [x, y, z, qx, qy, qz, qw] */
  frames: number[][][];
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Índice do elemento (face ou vértice) mais alto após a rotação final. */
function topIndex(shape: DieShape, q: Quaternion): number {
  const directions: Vec3[] = shape.readBy === "vertex" ? shape.vertices : faceNormals(shape);
  let best = 0;
  let bestY = -Infinity;
  directions.forEach((d, index) => {
    const y = q.vmult(new CVec3(d[0], d[1], d[2])).y;
    if (y > bestY) {
      bestY = y;
      best = index;
    }
  });
  return best;
}

/** Quão alinhado à vertical está o elemento de leitura (1 = perfeito). */
function uprightness(shape: DieShape, q: Quaternion): number {
  const index = topIndex(shape, q);
  const d = shape.readBy === "vertex" ? shape.vertices[index] : faceNormals(shape)[index];
  const up = q.vmult(new CVec3(d[0], d[1], d[2]));
  return up.y / up.length();
}

interface Attempt {
  frames: number[][][];
  quaternions: Quaternion[];
  settled: boolean;
  tilted: number;
}

function attempt(requests: DieRequest[]): Attempt {
  const world = new World({ gravity: new CVec3(0, -40, 0), allowSleep: true });
  const diceMaterial = new Material("die");
  const tableMaterial = new Material("table");
  world.addContactMaterial(new ContactMaterial(diceMaterial, tableMaterial, { friction: 0.35, restitution: 0.3 }));
  world.addContactMaterial(new ContactMaterial(diceMaterial, diceMaterial, { friction: 0.2, restitution: 0.4 }));

  const floor = new Body({ mass: 0, material: tableMaterial, shape: new Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  const walls: [CVec3, number][] = [
    [new CVec3(TRAY.halfWidth, 0, 0), -Math.PI / 2],
    [new CVec3(-TRAY.halfWidth, 0, 0), Math.PI / 2],
    [new CVec3(0, 0, TRAY.halfDepth), Math.PI],
    [new CVec3(0, 0, -TRAY.halfDepth), 0],
  ];
  for (const [position, angle] of walls) {
    const wall = new Body({ mass: 0, material: tableMaterial, shape: new Plane(), position });
    wall.quaternion.setFromEuler(0, angle, 0);
    world.addBody(wall);
  }

  const bodies = requests.map((request, index) => {
    const shape = getDieShape(request.sides);
    const body = new Body({
      mass: 1,
      material: diceMaterial,
      shape: new ConvexPolyhedron({
        vertices: shape.vertices.map(([x, y, z]) => new CVec3(x, y, z)),
        faces: shape.faces,
      }),
      position: new CVec3(
        -TRAY.halfWidth + 1.4 + (index % 3) * 0.9,
        random(2.5, 4),
        -TRAY.halfDepth * 0.6 + ((index * 1.3) % (TRAY.halfDepth * 1.2)),
      ),
      sleepSpeedLimit: 0.25,
      sleepTimeLimit: 0.25,
      angularDamping: 0.2,
      linearDamping: 0.08,
    });
    body.quaternion.setFromEuler(random(0, Math.PI * 2), random(0, Math.PI * 2), random(0, Math.PI * 2));
    body.velocity.set(random(10, 15), random(-2, 1), random(-3, 3));
    body.angularVelocity.set(random(-18, 18), random(-18, 18), random(-18, 18));
    world.addBody(body);
    return body;
  });

  const frames: number[][][] = [];
  let settled = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    world.step(STEP);
    frames.push(bodies.map((b) => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
    if (bodies.every((b) => b.sleepState === Body.SLEEPING)) {
      settled = true;
      break;
    }
  }
  const quaternions = bodies.map((b) => b.quaternion.clone());
  const tilted = requests.filter((r, i) => uprightness(getDieShape(r.sides), quaternions[i]) < FLAT).length;
  return { frames, quaternions, settled, tilted };
}

const FLAT = 0.97;
const MAX_ATTEMPTS = 6;

export function simulateRoll(requests: DieRequest[]): Simulation {
  // Como tudo é calculado antes de exibir, um lançamento que termina com dado
  // inclinado (apoiado em outro ou na borda) é descartado e refeito.
  let best = attempt(requests);
  for (let i = 1; i < MAX_ATTEMPTS && (best.tilted > 0 || !best.settled); i++) {
    const next = attempt(requests);
    if (next.tilted + (next.settled ? 0 : 1) < best.tilted + (best.settled ? 0 : 1)) best = next;
  }

  const dice = requests.map((request, index) => {
    const shape = getDieShape(request.sides);
    const labels = [...request.labels];
    const up = topIndex(shape, best.quaternions[index]);
    const current = labels.indexOf(request.value);
    if (current >= 0 && current !== up) [labels[up], labels[current]] = [labels[current], labels[up]];
    return { sides: request.sides, labels, value: request.value };
  });

  return { dice, frames: trimStill(best.frames) };
}

/** Corta o final em que nenhum dado se move de forma visível. */
function trimStill(frames: number[][][]): number[][][] {
  const last = frames[frames.length - 1];
  let end = frames.length;
  while (end > 1) {
    const frame = frames[end - 2];
    const moving = frame.some((die, i) => {
      const position = Math.hypot(die[0] - last[i][0], die[1] - last[i][1], die[2] - last[i][2]);
      const rotation = 1 - Math.abs(die[3] * last[i][3] + die[4] * last[i][4] + die[5] * last[i][5] + die[6] * last[i][6]);
      return position > 0.01 || rotation > 1e-4;
    });
    if (moving) break;
    end--;
  }
  return frames.slice(0, end);
}

/** Converte a rolagem do servidor em dados físicos (d100 = dezena + unidade). */
export function diceForRoll(sides: number, rolls: number[], maxDice = 10): DieRequest[] {
  const requests: DieRequest[] = [];
  for (const value of rolls) {
    if (sides === 100) {
      const tens = value === 100 ? 0 : Math.floor(value / 10);
      const units = value % 10;
      requests.push(
        { sides: 10, value: tens === 0 ? "00" : `${tens}0`, labels: Array.from({ length: 10 }, (_, i) => (i === 0 ? "00" : `${i}0`)) },
        { sides: 10, value: String(units), labels: Array.from({ length: 10 }, (_, i) => String(i)) },
      );
    } else {
      const s = sides as DieShape["sides"];
      requests.push({ sides: s, value: String(value), labels: Array.from({ length: sides }, (_, i) => String(i + 1)) });
    }
    if (requests.length >= maxDice) break;
  }
  return requests.slice(0, maxDice);
}
