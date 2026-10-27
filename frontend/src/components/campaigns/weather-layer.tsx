"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Weather, WeatherParticles } from "@/lib/weather";

// Clima sobre o mapa 2D (IM-08). Fica abaixo da grade e da névoa de guerra
// (células nubladas cobrem as partículas) e não captura cliques.

const MAX_PARTICLES: Partial<Record<Weather, number>> = { rain: 150, storm: 150, snow: 120, wind: 60 };

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  drift: number;
}

function spawn(width: number, height: number, anywhere: boolean): Particle {
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -10,
    speed: 0.6 + Math.random() * 0.8,
    size: 0.6 + Math.random() * 0.9,
    drift: Math.random() * Math.PI * 2,
  };
}

function ParticleCanvas({ weather, count }: { weather: Weather; count: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || count === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: count }, () => spawn(width, height, true));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      // Aba oculta: não gasta processamento.
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      const heavy = weather === "storm";
      for (const p of particles) {
        if (weather === "snow") {
          p.drift += dt;
          p.y += p.speed * 40 * dt;
          p.x += Math.sin(p.drift) * 12 * dt;
          ctx.fillStyle = "rgba(245, 247, 250, 0.85)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (weather === "wind") {
          p.x += p.speed * 420 * dt;
          p.y += Math.sin(p.drift + p.x / 60) * 0.4;
          ctx.strokeStyle = "rgba(230, 217, 184, 0.28)";
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 40 * p.speed, p.y);
          ctx.stroke();
        } else {
          const vx = heavy ? 140 : 60;
          const vy = (heavy ? 900 : 650) * p.speed;
          p.x += vx * dt;
          p.y += vy * dt;
          ctx.strokeStyle = heavy ? "rgba(190, 205, 230, 0.55)" : "rgba(190, 205, 230, 0.4)";
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - vx * 0.02, p.y - vy * 0.02);
          ctx.stroke();
        }
        if (p.y > height + 20 || p.x > width + 60) Object.assign(p, spawn(width, height, false), weather === "wind" ? { x: -60, y: Math.random() * height } : {});
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [weather, count]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/** Relâmpago raro na tempestade; nunca com movimento reduzido. */
function Lightning() {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 140);
        schedule();
      }, 8000 + Math.random() * 12000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-100 ${flash ? "opacity-35" : "opacity-0"}`} />;
}

interface WeatherLayerProps {
  weather: Weather;
  outdoors: boolean;
  particles: WeatherParticles;
}

export function WeatherLayer({ weather, outdoors, particles }: WeatherLayerProps) {
  const reduceMotion = useReducedMotion();
  if (!outdoors || weather === "clear") return null;
  const max = MAX_PARTICLES[weather] ?? 0;
  const count = particles === "off" ? 0 : particles === "reduced" || reduceMotion ? Math.round(max / 3) : max;
  return (
    <div aria-hidden="true" data-weather={weather} className="pointer-events-none absolute inset-0 overflow-hidden">
      {weather === "cloudy" || weather === "storm" || weather === "rain" ? (
        <div className={`absolute inset-0 ${weather === "storm" ? "bg-[rgb(20_23_30/0.3)]" : "bg-[rgb(40_45_55/0.18)]"}`} />
      ) : null}
      {weather === "fog" ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(220,224,228,0.45),transparent_60%),radial-gradient(ellipse_at_75%_70%,rgba(220,224,228,0.4),transparent_55%)] motion-safe:animate-pulse" />
      ) : null}
      {count > 0 ? <ParticleCanvas weather={weather} count={count} /> : null}
      {weather === "storm" && !reduceMotion && particles !== "off" ? <Lightning /> : null}
    </div>
  );
}
