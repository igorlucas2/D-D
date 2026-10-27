"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";
import type { TablePing } from "@/components/campaigns/table-presence";
import type { StageFocus } from "@/components/campaigns/map-stage";
import { TableCameraControls } from "@/components/campaigns/table-camera-controls";
import type { DayPhaseStyle } from "@/lib/day-phase";
import { playerColor } from "@/lib/player-color";
import type { VttMap, VttToken } from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

// Imagens externas precisam passar pelo proxy para virarem texturas WebGL sem erro de CORS.
function toTextureUrl(url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:") || (url.startsWith("/") && !url.startsWith("//"))) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

// Evita que falhas ao carregar texturas externas (CORS, 404, etc.) derrubem a cena 3D inteira.
class TextureErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function sunPosition(lighting: DayPhaseStyle, span: number) {
  const elevation = (lighting.sun.elevation * Math.PI) / 180;
  const azimuth = (lighting.sun.azimuth * Math.PI) / 180;
  const distance = span * 1.4;
  return new Vector3(
    Math.sin(azimuth) * Math.cos(elevation) * distance,
    Math.sin(elevation) * distance,
    -Math.cos(azimuth) * Math.cos(elevation) * distance,
  );
}

// Luz da fase do dia (IM-01): interpola em ~1,5 s até o alvo; com movimento
// reduzido, troca direto.
function SceneLights({ lighting, span }: { lighting: DayPhaseStyle; span: number }) {
  const sunRef = useRef<DirectionalLight>(null);
  const ambientRef = useRef<AmbientLight>(null);
  const reduceMotion = useReducedMotion();
  // Props fixas: o useFrame conduz a transição; props novas a cortariam.
  const [initial] = useState(lighting);
  const target = useMemo(
    () => ({ color: new Color(lighting.sun.color), position: sunPosition(lighting, span) }),
    [lighting, span],
  );

  useFrame((_, delta) => {
    const sun = sunRef.current;
    const ambient = ambientRef.current;
    if (!sun || !ambient) return;
    const t = reduceMotion ? 1 : Math.min(1, delta * 2);
    sun.color.lerp(target.color, t);
    sun.position.lerp(target.position, t);
    sun.intensity += (lighting.sun.intensity - sun.intensity) * t;
    ambient.intensity += (lighting.ambient - ambient.intensity) * t;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={initial.ambient} />
      <directionalLight
        ref={sunRef}
        position={sunPosition(initial, span).toArray()}
        color={initial.sun.color}
        intensity={initial.sun.intensity}
      />
    </>
  );
}

interface SurfaceProps {
  map: VttMap;
  planeWidth: number;
  planeHeight: number;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
}

function TexturedSurface({ map, planeWidth, planeHeight, onPointerMove }: SurfaceProps) {
  const texture = useTexture(toTextureUrl(map.imageUrl as string));

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerMove={onPointerMove}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

function PlainSurface({ planeWidth, planeHeight, onPointerMove }: SurfaceProps) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerMove={onPointerMove}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshStandardMaterial color="#5b3a21" />
    </mesh>
  );
}

function TableSurface({ map, planeWidth, planeHeight, onPointerMove }: SurfaceProps) {
  if (!map.imageUrl) {
    return <PlainSurface map={map} planeWidth={planeWidth} planeHeight={planeHeight} onPointerMove={onPointerMove} />;
  }
  return (
    <TextureErrorBoundary
      fallback={<PlainSurface map={map} planeWidth={planeWidth} planeHeight={planeHeight} onPointerMove={onPointerMove} />}
    >
      <TexturedSurface map={map} planeWidth={planeWidth} planeHeight={planeHeight} onPointerMove={onPointerMove} />
    </TextureErrorBoundary>
  );
}

function GridLines({
  map,
  planeWidth,
  planeHeight,
}: {
  map: VttMap;
  planeWidth: number;
  planeHeight: number;
}) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const w = map.width;
    const h = map.height;
    const scaleX = planeWidth / w;
    const scaleY = planeHeight / h;
    for (let i = 0; i <= w; i++) {
      const x = i * scaleX - planeWidth / 2;
      points.push(x, 0, -planeHeight / 2, x, 0, planeHeight / 2);
    }
    for (let j = 0; j <= h; j++) {
      const z = j * scaleY - planeHeight / 2;
      points.push(-planeWidth / 2, 0, z, planeWidth / 2, 0, z);
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new Float32BufferAttribute(points, 3));
    return geom;
  }, [map.width, map.height, planeWidth, planeHeight]);

  return (
    <lineSegments geometry={geometry} position={[0, 0.02, 0]}>
      <lineBasicMaterial color={map.gridColor} transparent opacity={0.6} />
    </lineSegments>
  );
}

// Névoa de guerra na mesa 3D, com a mesma regra da 2D: opaca para o jogador,
// translúcida para o mestre editar. Uma única malha instanciada por mapa.
function FogCells({
  map,
  fogCells,
  planeWidth,
  planeHeight,
  isMaster,
}: {
  map: VttMap;
  fogCells: string[];
  planeWidth: number;
  planeHeight: number;
  isMaster: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const cells = useMemo(
    () =>
      fogCells
        .map((key) => key.split(":").map(Number))
        .filter(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height),
    [fogCells, map.width, map.height],
  );
  const cellWidth = planeWidth / map.width;
  const cellDepth = planeHeight / map.height;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new Object3D();
    cells.forEach(([x, y], index) => {
      dummy.position.set(
        (x + 0.5) * cellWidth - planeWidth / 2,
        0.03,
        (y + 0.5) * cellDepth - planeHeight / 2,
      );
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(cellWidth, cellDepth, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.count = cells.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [cells, cellWidth, cellDepth, planeWidth, planeHeight]);

  if (cells.length === 0) return null;
  return (
    <instancedMesh key={cells.length} ref={meshRef} args={[undefined, undefined, cells.length]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#141715" transparent={isMaster} opacity={isMaster ? 0.65 : 1} />
    </instancedMesh>
  );
}

// Pings na mesa 3D: anel que se expande na célula apontada.
function PingRing({ ping, position }: { ping: TablePing; position: [number, number, number] }) {
  const ref = useRef<Mesh>(null);
  const started = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (reduceMotion) {
      mesh.scale.setScalar(1);
      (mesh.material as MeshBasicMaterial).opacity = 0.9;
      return;
    }
    started.current ??= clock.elapsedTime;
    const t = ((clock.elapsedTime - started.current) % 1.2) / 1.2;
    mesh.scale.setScalar(0.4 + t * 1.6);
    (mesh.material as MeshBasicMaterial).opacity = 1 - t;
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.5, 32]} />
      <meshBasicMaterial color={playerColor(ping.userId)} transparent />
    </mesh>
  );
}

function TexturedPawnMaterial({ imageUrl, selected }: { imageUrl: string; selected: boolean }) {
  const texture = useTexture(toTextureUrl(imageUrl));

  return (
    <meshStandardMaterial
      color="#ffffff"
      map={texture}
      emissive={selected ? "#f0c674" : "#000000"}
      emissiveIntensity={selected ? 0.6 : 0}
    />
  );
}

function PlainPawnMaterial({ color, selected }: { color: string; selected: boolean }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={selected ? "#f0c674" : "#000000"}
      emissiveIntensity={selected ? 0.6 : 0}
    />
  );
}

interface TokenPawnProps {
  token: VttToken;
  position: [number, number, number];
  cellScaleZ: number;
  selected: boolean;
  isMaster: boolean;
  onSelect: () => void;
  onDragStart: () => void;
}

function TokenPawn({ token, position, cellScaleZ, selected, isMaster, onSelect, onDragStart }: TokenPawnProps) {
  const radius = token.size * 0.4;

  return (
    <mesh
      position={position}
      scale={[1, 1, cellScaleZ]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        if (isMaster) onDragStart();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = isMaster ? "grab" : "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <cylinderGeometry args={[radius, radius, 0.3, 24]} />
      {token.imageUrl ? (
        <TextureErrorBoundary fallback={<PlainPawnMaterial color={token.color} selected={selected} />}>
          <TexturedPawnMaterial imageUrl={token.imageUrl} selected={selected} />
        </TextureErrorBoundary>
      ) : (
        <PlainPawnMaterial color={token.color} selected={selected} />
      )}
    </mesh>
  );
}

interface VttTable3DProps {
  map: VttMap;
  tokens: VttToken[];
  selectedTokenId: string;
  isMaster: boolean;
  imageNaturalSize: { width: number; height: number } | null;
  fogCells: string[];
  pings: TablePing[];
  lighting: DayPhaseStyle;
  focus: StageFocus | null;
  onFocusHandled: (key: number) => void;
  onSelectToken: (id: string) => void;
  onMoveToken: (token: VttToken, x: number, y: number) => void;
}

// Mesa 3D estilo "tabletop": superfície com a textura do mapa, peões arrastáveis e câmera orbital.
export function VttTable3D({
  map,
  tokens,
  selectedTokenId,
  isMaster,
  imageNaturalSize,
  fogCells,
  pings,
  lighting,
  focus,
  onFocusHandled,
  onSelectToken,
  onMoveToken,
}: VttTable3DProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewPositions, setPreviewPositions] = useState<Record<string, { x: number; y: number }>>({});

  const draggingIdRef = useRef<string | null>(null);
  const previewRef = useRef<Record<string, { x: number; y: number }>>({});
  const tokensRef = useRef(tokens);

  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);
  useEffect(() => {
    previewRef.current = previewPositions;
  }, [previewPositions]);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    function handlePointerUp() {
      const id = draggingIdRef.current;
      if (!id) return;
      const token = tokensRef.current.find((item) => item.id === id);
      const preview = previewRef.current[id];
      if (token && preview) {
        const x = Math.round(preview.x);
        const y = Math.round(preview.y);
        if (x !== token.x || y !== token.y) onMoveToken(token, x, y);
      }
      setDraggingId(null);
    }
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [onMoveToken]);

  // A largura da mesa segue o grid; a altura segue a proporção real da imagem
  // (igual ao modo 2D), evitando achatar/esticar o mapa.
  const planeWidth = map.width;
  const planeHeight = imageNaturalSize
    ? (map.width * imageNaturalSize.height) / imageNaturalSize.width
    : map.height;
  const scaleY = planeHeight / map.height;

  function handleSurfacePointerMove(event: ThreeEvent<PointerEvent>) {
    const id = draggingIdRef.current;
    if (!id) return;
    event.stopPropagation();
    const token = tokensRef.current.find((item) => item.id === id);
    if (!token) return;
    const x = clamp(event.point.x + planeWidth / 2 - token.size / 2, 0, map.width - token.size);
    const y = clamp((event.point.z + planeHeight / 2) / scaleY - token.size / 2, 0, map.height - token.size);
    setPreviewPositions((prev) => ({ ...prev, [id]: { x, y } }));
  }

  const span = Math.max(planeWidth, planeHeight);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, span * 0.9, span * 0.9], fov: 45 }}
      onPointerMissed={() => onSelectToken("")}
    >
      <SceneLights lighting={lighting} span={span} />
      <Suspense fallback={null}>
        <TableSurface map={map} planeWidth={planeWidth} planeHeight={planeHeight} onPointerMove={handleSurfacePointerMove} />
        <GridLines map={map} planeWidth={planeWidth} planeHeight={planeHeight} />
        {pings.map((ping) => (
          <PingRing
            key={ping.key}
            ping={ping}
            position={[ping.x + 0.5 - planeWidth / 2, 0.06, (ping.y + 0.5) * scaleY - planeHeight / 2]}
          />
        ))}
        <FogCells map={map} fogCells={fogCells} planeWidth={planeWidth} planeHeight={planeHeight} isMaster={isMaster} />
        {tokens.map((mapToken) => {
          const preview = previewPositions[mapToken.id];
          const x = preview?.x ?? mapToken.x;
          const y = preview?.y ?? mapToken.y;
          return (
            <TokenPawn
              key={mapToken.id}
              token={mapToken}
              selected={mapToken.id === selectedTokenId}
              isMaster={isMaster}
              cellScaleZ={scaleY}
              position={[
                x - planeWidth / 2 + mapToken.size / 2,
                0.15,
                (y + mapToken.size / 2) * scaleY - planeHeight / 2,
              ]}
              onSelect={() => onSelectToken(mapToken.id)}
              onDragStart={() => setDraggingId(mapToken.id)}
            />
          );
        })}
      </Suspense>
      <TableCameraControls
        focus={focus}
        onFocusHandled={onFocusHandled}
        planeWidth={planeWidth}
        planeHeight={planeHeight}
        enabled={!draggingId}
      />
    </Canvas>
  );
}
