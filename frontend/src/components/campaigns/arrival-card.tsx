"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";

export interface Arrival {
  /** Identifica cada chegada; uma nova viagem reinicia o cartão. */
  key: number;
  title: string;
  path: string[];
  travelMinutes: number | null;
}

const VISIBLE_MS = 1800;

function formatTravel(minutes: number) {
  if (minutes < 60) return `+${minutes} min de viagem`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `+${hours} h${rest ? ` ${rest} min` : ""} de viagem`;
}

interface ArrivalCardProps {
  arrival: Arrival | null;
  /** Data/fase atuais, lidas ao vivo: o relógio pode avançar logo após a viagem. */
  when: string | null;
  onDone: () => void;
}

// Cartão de chegada a um local (IM-03). Curto, interrompível por clique ou
// teclado e anunciado a leitores de tela.
export function ArrivalCard({ arrival, when, onDone }: ArrivalCardProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(onDone, VISIBLE_MS);
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [arrival, onDone]);

  const breadcrumb = arrival ? arrival.path.slice(-3, -1) : [];

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {arrival ? `Chegada: ${arrival.title}${when ? `, ${when}` : ""}` : ""}
      </p>
      <AnimatePresence>
        {arrival ? (
          <motion.div
            key={arrival.key}
            role="presentation"
            onClick={onDone}
            className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(20,23,21,0.82),rgba(20,23,21,0.45)_70%)] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduceMotion ? 0.15 : 0.3 } }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0.15 : 0.4 } }}
          >
            <motion.div
              className="flex max-w-xl flex-col items-center gap-2 text-center"
              initial={reduceMotion ? false : { y: 8, scale: 0.98 }}
              animate={{ y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }}
            >
              {breadcrumb.length > 0 ? (
                <p className="flex flex-wrap items-center justify-center gap-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {breadcrumb.map((name, index) => (
                    <span key={`${name}-${index}`} className="flex items-center gap-1">
                      {index > 0 ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
                      {name}
                    </span>
                  ))}
                </p>
              ) : null}
              <span aria-hidden="true" className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--rpg-bronze)] to-transparent" />
              <h3 className="font-heading text-2xl text-[var(--rpg-parchment)] drop-shadow sm:text-4xl">{arrival.title}</h3>
              <span aria-hidden="true" className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--rpg-bronze)] to-transparent" />
              {when ? <p className="font-[family-name:var(--font-body)] text-base text-[var(--rpg-parchment)] sm:text-lg">{when}</p> : null}
              {arrival.travelMinutes ? (
                <p className="text-sm tabular-nums text-muted-foreground">{formatTravel(arrival.travelMinutes)}</p>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
