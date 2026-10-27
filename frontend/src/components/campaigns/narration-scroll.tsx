"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { TableNarration } from "@/lib/types";

interface NarrationScrollProps {
  narration: TableNarration | null;
  /** Narrações ainda na fila depois desta. */
  pending: number;
  onClose: () => void;
}

// Narração em pergaminho (IM-06). Abre sobre o palco sem prendê-lo: o mapa
// continua por trás e "Fechar" (ou Esc) devolve o foco a quem estava antes.
export function NarrationScroll({ narration, pending, onClose }: NarrationScrollProps) {
  const reduceMotion = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!narration) return;
    previousFocus.current ??= document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [narration, onClose]);

  useEffect(() => {
    if (narration || !previousFocus.current) return;
    previousFocus.current.focus?.();
    previousFocus.current = null;
  }, [narration]);

  const titleId = narration ? `narration-${narration.id}` : undefined;

  return (
    <AnimatePresence>
      {narration ? (
        <motion.div
          key={narration.id}
          className="absolute inset-0 z-30 flex items-center justify-center bg-[rgb(20_23_21/0.55)] p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.25 }}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="parchment flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border-2 border-[var(--rpg-bronze)] bg-[var(--rpg-parchment)] text-[var(--rpg-charcoal)] shadow-2xl shadow-black/50 outline-none"
            initial={reduceMotion ? false : { scaleY: 0.6, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{ transformOrigin: "top" }}
          >
            <div className="flex flex-col gap-1 border-b border-[rgb(20_23_21/0.2)] px-5 pt-4 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(20_23_21/0.7)]">
                {narration.from} narra{narration.restricted ? " · somente para você" : ""}
              </p>
              <h3 id={titleId} className="font-heading text-xl sm:text-2xl">
                {narration.title ?? "Narração"}
              </h3>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-lg leading-7">{narration.content}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(20_23_21/0.2)] px-5 py-3">
              <span className="text-sm text-[rgb(20_23_21/0.7)]">
                {narration.journalEntryId ? "Guardada no diário." : "Não foi guardada no diário."}
                {pending > 0 ? ` Mais ${pending} a seguir.` : ""}
              </span>
              <Button className="h-11" onClick={onClose}>
                {pending > 0 ? "Próxima" : "Fechar"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
