"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Ponto a centralizar, em fração do mapa (0–1); `key` novo repete o foco. */
export interface StageFocus {
  x: number;
  y: number;
  key: number;
}

export function MapStage({ children, label, aspectRatio, compact = false, focus = null, onFocusHandled }: { children: ReactNode; label: string; aspectRatio: number; compact?: boolean; focus?: StageFocus | null; onFocusHandled?: (key: number) => void }) {
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  // "Olhem aqui" (IM-05): amplia se necessário e centraliza o ponto pedido.
  useEffect(() => {
    if (!focus) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o foco vem de um evento externo (socket)
    setZoom((current) => Math.max(current, 2));
    // Dois quadros: o primeiro aplica a nova ampliação, o segundo mede.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => centre());
    });
    function centre() {
      if (!focus) return;
      const view = viewport.current;
      const inner = content.current;
      if (!view || !inner) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      view.scrollTo({
        left: inner.offsetLeft + focus.x * inner.offsetWidth - view.clientWidth / 2,
        top: inner.offsetTop + focus.y * inner.offsetHeight - view.clientHeight / 2,
        behavior: reduce ? "instant" : "smooth",
      });
      onFocusHandled?.(focus.key);
    }
    return () => window.cancelAnimationFrame(frame);
  }, [focus, onFocusHandled]);

  function fitMap() {
    setZoom(1);
    viewport.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-primary/30 bg-background/60" style={{ "--map-height": compact ? "max(16rem, calc(100dvh - 26rem))" : "68dvh" } as CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2 py-1">
        <p className="min-w-0 flex-1 truncate px-1 text-sm font-medium" title={label}>{label}</p>
        <div role="group" aria-label="Ampliação do mapa" className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-11" aria-label="Diminuir mapa" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}><Minus className="size-4" /></Button>
          <output aria-live="polite" className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</output>
          <Button variant="ghost" size="icon" className="size-11" aria-label="Ampliar mapa" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><Plus className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-11" aria-label="Ajustar mapa à área visível" title="Ajustar ao mapa" onClick={fitMap}><Maximize className="size-4" /></Button>
        </div>
      </div>
      <div ref={viewport} role="region" aria-label={`Mapa: ${label}`} tabIndex={0} className="max-h-[var(--map-height)] min-w-0 overflow-auto overscroll-contain [scrollbar-color:var(--primary)_var(--background)]">
        <div ref={content} className="mx-auto" style={{ width: `min(${zoom * 100}%, calc(var(--map-height) * ${aspectRatio * zoom}))` }}>{children}</div>
      </div>
      <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">Amplie para ver os detalhes e deslize para navegar. Na grade, use as setas e Enter.</p>
    </div>
  );
}
