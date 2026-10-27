"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { Vector3 } from "three";
import type { StageFocus } from "@/components/campaigns/map-stage";

interface CameraMove {
  key: number;
  elapsed: number;
  fromPosition: Vector3;
  fromTarget: Vector3;
  position: Vector3;
  target: Vector3;
}

interface TableCameraControlsProps {
  focus: StageFocus | null;
  planeWidth: number;
  planeHeight: number;
  enabled: boolean;
  onFocusHandled: (key: number) => void;
}

/** IM-05: foco pontual do mestre; qualquer gesto devolve o controle ao jogador. */
export function TableCameraControls({ focus, planeWidth, planeHeight, enabled, onFocusHandled }: TableCameraControlsProps) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const move = useRef<CameraMove | null>(null);
  const reduceMotion = useReducedMotion();
  const span = Math.max(planeWidth, planeHeight);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !focus || !enabled) return;

    // Consome a inércia anterior antes de calcular o trajeto programático.
    orbit.enableDamping = false;
    orbit.update();
    const target = new Vector3((focus.x - 0.5) * planeWidth, 0, (focus.y - 0.5) * planeHeight);
    const offset = orbit.object.position.clone().sub(orbit.target);
    // Equivale a 200% da distância inicial. Repetir o foco não acumula zoom,
    // e quem já aproximou mais mantém sua distância e ângulo de observação.
    const distance = Math.max(span * 0.4, Math.min(offset.length(), (Math.SQRT2 * span * 0.9) / 2));
    if (offset.lengthSq() === 0) offset.set(0, 1, 1);
    const position = target.clone().add(offset.setLength(distance));

    move.current = {
      key: focus.key,
      elapsed: 0,
      fromPosition: orbit.object.position.clone(),
      fromTarget: orbit.target.clone(),
      position,
      target,
    };

    return () => {
      move.current = null;
      orbit.enableDamping = !reduceMotion;
    };
  }, [focus, planeWidth, planeHeight, span, enabled, reduceMotion]);

  useFrame((_, delta) => {
    const orbit = controls.current;
    const current = move.current;
    if (!orbit || !current) return;

    current.elapsed += delta;
    const progress = reduceMotion ? 1 : Math.min(1, current.elapsed / 0.3);
    const eased = progress * progress * (3 - 2 * progress);
    orbit.target.lerpVectors(current.fromTarget, current.target, eased);
    orbit.object.position.lerpVectors(current.fromPosition, current.position, eased);
    orbit.update();

    if (progress === 1) {
      move.current = null;
      orbit.enableDamping = !reduceMotion;
      onFocusHandled(current.key);
    }
  });

  function interruptFocus() {
    const current = move.current;
    move.current = null;
    if (controls.current) controls.current.enableDamping = !reduceMotion;
    if (current) onFocusHandled(current.key);
  }

  return (
    <OrbitControls
      ref={controls}
      enabled={enabled}
      enableDamping={!reduceMotion}
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={span * 0.4}
      maxDistance={span * 2.5}
      onStart={interruptFocus}
    />
  );
}
