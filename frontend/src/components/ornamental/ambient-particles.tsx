"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
}

function randomUnit(seed: number): number {
  let value = (seed + 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: randomUnit(id * 5 + 1) * 100,
    size: 2 + randomUnit(id * 5 + 2) * 3,
    duration: 10 + randomUnit(id * 5 + 3) * 12,
    delay: randomUnit(id * 5 + 4) * 10,
    drift: (randomUnit(id * 5 + 5) - 0.5) * 60,
  }));
}

interface AmbientParticlesProps {
  count?: number;
  className?: string;
}

// Faíscas/poeira mágica subindo lentamente, para dar atmosfera às fichas e painéis.
export function AmbientParticles({ count = 18, className = "" }: AmbientParticlesProps) {
  const particles = useMemo(() => makeParticles(count), [count]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="ambient-particle absolute rounded-full bg-primary/60"
          style={{
            left: `${particle.left}%`,
            width: particle.size,
            height: particle.size,
            bottom: "-5%",
            boxShadow: "0 0 6px 1px var(--primary)",
          }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{
            opacity: [0, 0.8, 0],
            y: ["0%", "-120%"],
            x: [0, particle.drift],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
