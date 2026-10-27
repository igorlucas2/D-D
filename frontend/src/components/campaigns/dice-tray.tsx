"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Group, PerspectiveCamera } from "three";
import { ambienceEngine } from "@/lib/audio/ambience-engine";
import { buildDieGeometry, buildDieMaterials } from "@/lib/dice/die-mesh";
import { diceForRoll, simulateRoll, TRAY, type Simulation } from "@/lib/dice/simulate";
import { playerColor } from "@/lib/player-color";
import type { DiceRoll } from "@/lib/types";
import { useTablePrefsStore } from "@/stores/table-prefs-store";

// Bandeja de dados compartilhada (IM-04): reproduz a simulação física sobre o
// palco e mostra o resultado do servidor. A animação é cosmética: o resultado
// em texto aparece de qualquer forma e a bandeja nunca captura cliques do mapa.

const MAX_PLAYBACK_SECONDS = 2.5;
const RESULT_SECONDS = 2.4;
const MAX_QUEUE_ANIMATED = 2;

export function rollerName(roll: DiceRoll) {
  return roll.character?.name ?? roll.user?.displayName ?? "Alguém";
}

export function rollHighlight(roll: DiceRoll): "critical" | "fumble" | null {
  const { diceCount, diceSides, rolls } = roll.breakdown;
  if (diceCount !== 1 || diceSides !== 20) return null;
  if (rolls[0] === 20) return "critical";
  if (rolls[0] === 1) return "fumble";
  return null;
}

export function describeBreakdown(roll: DiceRoll) {
  const { rolls, modifier } = roll.breakdown;
  const parts = rolls.join(" + ");
  if (!modifier) return rolls.length > 1 ? parts : "";
  return `${parts} ${modifier > 0 ? "+" : "−"} ${Math.abs(modifier)}`;
}

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const halfFov = (perspective.fov * Math.PI) / 360;
    // Distância para a bandeja inteira caber na largura e na altura do palco.
    const byWidth = (TRAY.halfWidth + 1.5) / (Math.tan(halfFov) * aspect);
    const byDepth = (TRAY.halfDepth + 1.5) / Math.tan(halfFov);
    const distance = Math.max(byWidth, byDepth);
    // Quase de cima: a face lida fica de frente para quem olha.
    perspective.position.set(0, distance * 0.99, distance * 0.14);
    perspective.lookAt(0, 0, 0);
    perspective.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Playback({ simulation, color, onFinished }: { simulation: Simulation; color: string; onFinished: () => void }) {
  const groups = useRef<(Group | null)[]>([]);
  const elapsed = useRef(0);
  const finished = useRef(false);
  const meshes = useMemo(
    () =>
      simulation.dice.map((die) => ({
        geometry: buildDieGeometry(die.sides),
        materials: buildDieMaterials(die.sides, die.labels, color, "#141715"),
      })),
    [simulation, color],
  );
  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        for (const material of mesh.materials) {
          material.map?.dispose();
          material.dispose();
        }
      }
    },
    [meshes],
  );

  const frameCount = simulation.frames.length;
  const speed = Math.max(1, frameCount / 60 / MAX_PLAYBACK_SECONDS);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const index = Math.min(frameCount - 1, Math.floor(elapsed.current * 60 * speed));
    const frame = simulation.frames[index];
    frame.forEach((pose, i) => {
      const group = groups.current[i];
      if (!group) return;
      group.position.set(pose[0], pose[1], pose[2]);
      group.quaternion.set(pose[3], pose[4], pose[5], pose[6]);
    });
    if (index === frameCount - 1 && !finished.current) {
      finished.current = true;
      onFinished();
    }
  });

  return (
    <>
      {meshes.map((mesh, i) => (
        <group key={i} ref={(node) => void (groups.current[i] = node)}>
          <mesh geometry={mesh.geometry} material={mesh.materials} />
        </group>
      ))}
    </>
  );
}

interface DiceTrayProps {
  roll: DiceRoll | null;
  /** Rolagens ainda na fila: com muitas, só o resultado é mostrado. */
  queued: number;
  onDone: () => void;
}

export function DiceTray({ roll, queued, onDone }: DiceTrayProps) {
  const reduceMotion = useReducedMotion();
  const preference = useTablePrefsStore((state) => state.diceAnimation);
  const animate = (preference ?? (reduceMotion ? "result" : "physics")) === "physics";
  const [phase, setPhase] = useState<"rolling" | "result">("result");

  const simulation = useMemo(() => {
    if (!roll || !animate || queued > MAX_QUEUE_ANIMATED) return null;
    const { diceSides, rolls } = roll.breakdown;
    const requests = diceForRoll(diceSides, rolls);
    return requests.length ? simulateRoll(requests) : null;
  }, [roll, animate, queued]);

  useEffect(() => {
    if (!roll) return;
    const highlight = rollHighlight(roll);
    const rollSeconds = simulation ? Math.min(MAX_PLAYBACK_SECONDS, simulation.frames.length / 60) : 0;
    if (simulation) ambienceEngine.sfx("dice", rollSeconds);
    if (highlight) ambienceEngine.sfx(highlight, rollSeconds);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia a fase a cada nova rolagem
    setPhase(simulation ? "rolling" : "result");
  }, [roll, simulation]);

  useEffect(() => {
    if (!roll || phase !== "result") return;
    const timer = window.setTimeout(onDone, RESULT_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [roll, phase, onDone]);

  const showResult = useCallback(() => setPhase("result"), []);

  if (!roll) return null;
  const highlight = rollHighlight(roll);
  const breakdown = describeBreakdown(roll);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden={phase === "rolling"}>
      {simulation ? (
        <Canvas key={roll.id} dpr={[1, 2]} camera={{ fov: 35, position: [0, 14, 5] }} gl={{ alpha: true }}>
          <CameraRig />
          <ambientLight intensity={0.85} />
          <directionalLight position={[3, 10, 4]} intensity={1.4} />
          <Playback simulation={simulation} color={playerColor(roll.userId)} onFinished={showResult} />
        </Canvas>
      ) : null}
      <AnimatePresence>
        {phase === "result" ? (
          <motion.div
            key={roll.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto absolute inset-x-0 bottom-4 mx-auto w-fit max-w-[calc(100%-2rem)] cursor-pointer rounded-xl border border-primary/40 bg-card/95 px-4 py-2 text-center shadow-xl shadow-black/40"
            onClick={onDone}
          >
            <p className="text-sm text-muted-foreground">
              <span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-full align-middle" style={{ backgroundColor: playerColor(roll.userId) }} />
              {rollerName(roll)} rolou <span className="tabular-nums">{roll.formula}</span>
              {roll.visibility === "MASTER" ? " · só mestre" : roll.visibility === "PRIVATE" ? " · privada" : ""}
            </p>
            <p className="font-heading text-3xl tabular-nums text-foreground">
              {roll.result}
              {breakdown ? <span className="ml-2 align-middle font-sans text-sm text-muted-foreground">({breakdown})</span> : null}
            </p>
            {highlight ? (
              <p className={`text-sm font-semibold ${highlight === "critical" ? "text-primary" : "text-destructive"}`}>
                {highlight === "critical" ? "Crítico!" : "Falha crítica"}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
