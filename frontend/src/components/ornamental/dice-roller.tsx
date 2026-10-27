"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import type { Mesh } from "three";
import { Button } from "@/components/ui/button";

const DICE_OPTIONS = [4, 6, 8, 10, 12, 20, 100] as const;

function DieGeometry({ sides }: { sides: number }) {
  switch (sides) {
    case 4:
      return <tetrahedronGeometry args={[1.4, 0]} />;
    case 6:
      return <boxGeometry args={[1.7, 1.7, 1.7]} />;
    case 8:
      return <octahedronGeometry args={[1.4, 0]} />;
    case 10:
    case 12:
    case 100:
      return <dodecahedronGeometry args={[1.2, 0]} />;
    case 20:
    default:
      return <icosahedronGeometry args={[1.3, 0]} />;
  }
}

interface Die3DProps {
  sides: number;
  rollToken: number;
  result: number | null;
  onSettle?: () => void;
  size?: string;
}

interface DieMeshProps {
  sides: number;
  rollToken: number;
  onSettle?: () => void;
}

function DieMesh({ sides, rollToken, onSettle }: DieMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const rollingRef = useRef(false);
  const lastTokenRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    if (rollToken === 0 || rollToken === lastTokenRef.current || !mesh) return;
    lastTokenRef.current = rollToken;
    rollingRef.current = true;
    gsap.to(mesh.rotation, {
      x: mesh.rotation.x + Math.PI * (4 + Math.random() * 2),
      y: mesh.rotation.y + Math.PI * (4 + Math.random() * 2),
      z: mesh.rotation.z + Math.PI * Math.random() * 2,
      duration: 1.3,
      ease: "power3.out",
      onComplete: () => {
        rollingRef.current = false;
        onSettle?.();
      },
    });
  }, [rollToken, onSettle]);

  useFrame((_, delta) => {
    if (!meshRef.current || rollingRef.current) return;
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.22;
  });

  return (
    <mesh ref={meshRef}>
      <DieGeometry sides={sides} />
      <meshStandardMaterial
        color="#d8b46a"
        metalness={0.55}
        roughness={0.3}
        emissive="#6d4f17"
        emissiveIntensity={0.3}
        flatShading
      />
    </mesh>
  );
}

// Dado 3D controlado externamente: gira quando rollToken muda e revela `result` ao terminar.
export function Die3D({ sides, rollToken, result, onSettle, size = "h-24 w-24" }: Die3DProps) {
  return (
    <div className={`relative ${size}`}>
      <Canvas camera={{ position: [0, 0, 4], fov: 40 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <pointLight position={[-3, -2, 2]} intensity={0.6} color="#f0c674" />
        <DieMesh sides={sides} rollToken={rollToken} onSettle={onSettle} />
      </Canvas>
      <AnimatePresence>
        {result !== null ? (
          <motion.div
            key={result}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="text-glow-primary pointer-events-none absolute inset-0 flex items-center justify-center font-heading text-3xl font-bold text-primary"
          >
            {result}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

interface DiceRollerProps {
  defaultSides?: number;
  className?: string;
  showSelector?: boolean;
}

// Dado 3D de rolagem rápida (sem histórico), com seletor de tipo (d4-d100).
export function DiceRoller({ defaultSides = 20, className = "", showSelector = true }: DiceRollerProps) {
  const [sides, setSides] = useState(defaultSides);
  const [rollToken, setRollToken] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  function roll() {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    setRollToken((token) => token + 1);
  }

  function handleSettle() {
    setResult(1 + Math.floor(Math.random() * sides));
    setRolling(false);
  }

  function selectSides(next: number) {
    if (rolling) return;
    setSides(next);
    setResult(null);
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {showSelector ? (
        <div className="flex flex-wrap justify-center gap-1">
          {DICE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => selectSides(option)}
              className={`rounded-md border px-1.5 py-0.5 text-xs font-medium transition-colors ${
                sides === option
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              d{option}
            </button>
          ))}
        </div>
      ) : null}
      <Die3D sides={sides} rollToken={rollToken} result={result} onSettle={handleSettle} />
      <Button size="sm" variant="outline" onClick={roll} disabled={rolling}>
        {rolling ? "Rolando..." : `Rolar d${sides}`}
      </Button>
    </div>
  );
}
