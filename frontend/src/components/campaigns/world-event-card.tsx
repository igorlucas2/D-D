"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell } from "lucide-react";
import { ambienceEngine } from "@/lib/audio/ambience-engine";
import { JOURNAL_CATEGORY_LABELS } from "@/lib/types";
import { WEATHER_LABELS } from "@/lib/weather";
import type { LiveWorldEvent } from "@/stores/world-calendar-store";

const VISIBLE_MS = 7000;

function firstSentence(text: string) {
  const match = text.match(/^[\s\S]+?[.!?](\s|$)/);
  return (match ? match[0] : text).trim().slice(0, 220);
}

// Evento do mundo ao vivo (IM-09): o sorteio do relógio vira um momento na
// mesa, com sino e um resumo; o texto completo continua no diário.
export function WorldEventCard({ event }: { event: LiveWorldEvent | null }) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState<LiveWorldEvent | null>(null);
  const shownKey = useRef<number | null>(null);

  useEffect(() => {
    if (!event || shownKey.current === event.key) return;
    shownKey.current = event.key;
    setVisible(event);
    ambienceEngine.sfx("bell");
    const timer = window.setTimeout(() => setVisible(null), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [event]);

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {visible ? `Acontecimento: ${visible.title}. ${firstSentence(visible.content)}` : ""}
      </p>
      <AnimatePresence>
        {visible ? (
          <motion.button
            key={visible.key}
            type="button"
            onClick={() => setVisible(null)}
            className="absolute right-3 bottom-14 z-30 flex max-w-sm flex-col gap-1 rounded-xl border border-primary/50 bg-card/95 px-4 py-3 text-left shadow-2xl shadow-black/50"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Bell className="size-3.5" aria-hidden="true" /> {JOURNAL_CATEGORY_LABELS[visible.category]}
              {visible.weather ? ` · ${WEATHER_LABELS[visible.weather]}` : ""}
            </span>
            <span className="font-heading text-lg text-foreground">{visible.title}</span>
            <span className="text-sm text-muted-foreground">{firstSentence(visible.content)}</span>
            <span className="text-xs text-muted-foreground">Registrado no diário · clique para fechar</span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
}
