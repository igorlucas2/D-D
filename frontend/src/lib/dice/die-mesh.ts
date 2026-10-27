import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  MeshStandardMaterial,
  SRGBColorSpace,
} from "three";
import { centroid, faceNormals, getDieShape, normalize, type DieShape, type Vec3 } from "@/lib/dice/polyhedra";

// Malha numerada de um dado: um grupo (e um material com textura própria) por
// face, para que os rótulos possam ser trocados depois da simulação.

const TEXTURE_SIZE = 128;

interface FaceUv {
  /** UV de cada vértice da face, na mesma ordem de `shape.faces[i]`. */
  corners: [number, number][];
}

function faceUvs(shape: DieShape): FaceUv[] {
  const normals = faceNormals(shape);
  return shape.faces.map((face, index) => {
    const points = face.map((i) => shape.vertices[i]);
    const center = centroid(points);
    const n = normals[index];
    const u = normalize([points[0][0] - center[0], points[0][1] - center[1], points[0][2] - center[2]]);
    const w: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const local = points.map((p) => {
      const d: Vec3 = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
      return [d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * w[0] + d[1] * w[1] + d[2] * w[2]] as [number, number];
    });
    const radius = Math.max(...local.map(([x, y]) => Math.hypot(x, y)));
    return { corners: local.map(([x, y]) => [0.5 + (x / radius) * 0.46, 0.5 + (y / radius) * 0.46]) };
  });
}

export function buildDieGeometry(sides: DieShape["sides"]): BufferGeometry {
  const shape = getDieShape(sides);
  const normals = faceNormals(shape);
  const uvs = faceUvs(shape);
  const positions: number[] = [];
  const normalData: number[] = [];
  const uvData: number[] = [];
  const geometry = new BufferGeometry();
  let vertexCount = 0;

  shape.faces.forEach((face, faceIndex) => {
    const start = vertexCount;
    for (let k = 1; k < face.length - 1; k++) {
      for (const corner of [0, k, k + 1]) {
        positions.push(...shape.vertices[face[corner]]);
        normalData.push(...normals[faceIndex]);
        uvData.push(...uvs[faceIndex].corners[corner]);
        vertexCount++;
      }
    }
    geometry.addGroup(start, vertexCount - start, faceIndex);
  });

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normalData, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvData, 2));
  return geometry;
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  // 6 e 9 sublinhados para não serem confundidos.
  if (text === "6" || text === "9") {
    const width = ctx.measureText(text).width;
    ctx.fillRect(-width / 2, size * 0.42, width, Math.max(2, size * 0.07));
  }
  ctx.restore();
}

const LABEL_SIZE: Record<DieShape["sides"], number> = { 4: 26, 6: 64, 8: 44, 10: 40, 12: 42, 20: 34 };

/**
 * Um material por face. No d4, cada face mostra os rótulos dos seus três
 * vértices, voltados para o respectivo canto (lê-se o número de cima).
 */
export function buildDieMaterials(sides: DieShape["sides"], labels: string[], color: string, ink: string) {
  const shape = getDieShape(sides);
  const uvs = faceUvs(shape);
  return shape.faces.map((face, faceIndex) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.fillStyle = ink;
    const toCanvas = ([u, v]: [number, number]) => [u * TEXTURE_SIZE, (1 - v) * TEXTURE_SIZE] as const;

    if (shape.readBy === "vertex") {
      const center = toCanvas([0.5, 0.5]);
      face.forEach((vertexIndex, corner) => {
        const [cx, cy] = toCanvas(uvs[faceIndex].corners[corner]);
        const x = center[0] + (cx - center[0]) * 0.55;
        const y = center[1] + (cy - center[1]) * 0.55;
        const angle = Math.atan2(cy - center[1], cx - center[0]) + Math.PI / 2;
        drawLabel(ctx, labels[vertexIndex], x, y, LABEL_SIZE[sides], angle);
      });
    } else {
      const text = labels[faceIndex];
      const size = text.length > 1 ? LABEL_SIZE[sides] * 0.8 : LABEL_SIZE[sides];
      const [x, y] = toCanvas([0.5, 0.5]);
      drawLabel(ctx, text, x, y, size);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return new MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.1, flatShading: true });
  });
}
