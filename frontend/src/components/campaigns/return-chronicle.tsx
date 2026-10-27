"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Hourglass, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { JOURNAL_CATEGORY_LABELS, type JournalCategory } from "@/lib/types";
import { WEATHER_ICONS, WEATHER_LABELS, type Weather } from "@/lib/weather";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const HEARTBEAT_MS = 5 * 60 * 1000;
/** Abaixo disso de tempo de jogo, sem entradas novas, não vale interromper. */
const MIN_GAME_MINUTES = 60;

type Summary =
  | { firstVisit: true }
  | {
      firstVisit: false;
      lastSeenAt: string;
      gameMinutesElapsed: number | null;
      weather: Weather;
      totalNew: number;
      entries: {
        id: string;
        title: string;
        excerpt: string;
        category: JournalCategory;
        restricted: boolean;
        createdAt: string;
      }[];
    };

function describeGameTime(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const parts = [
    days ? `${days} ${days === 1 ? "dia" : "dias"}` : null,
    hours ? `${hours} ${hours === 1 ? "hora" : "horas"}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return `${minutes} minutos se passaram no mundo`;
  const singular = (days === 1 && !hours) || (hours === 1 && !days);
  return `${parts.join(" e ")} ${singular ? "se passou" : "se passaram"} no mundo`;
}

function describeRealTime(iso: string) {
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const format = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return format.format(diffMinutes, "minute");
  if (Math.abs(diffMinutes) < 1440) return format.format(Math.round(diffMinutes / 60), "hour");
  return format.format(Math.round(diffMinutes / 1440), "day");
}

// Resumo de retorno (IM-10): ao voltar à campanha, o que mudou desde a última
// visita. Mostrado uma vez por visita; a visita é marcada logo depois de ler o
// resumo e renovada enquanto a página está aberta.
export function ReturnChronicle({ campaignId }: { campaignId: string }) {
  const token = useAuthStore((state) => state.token);
  const reduceMotion = useReducedMotion();
  const [summary, setSummary] = useState<Extract<Summary, { firstVisit: false }> | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const markVisit = () => api.post(`/campaigns/${campaignId}/journal/visit`, undefined, token).catch(() => undefined);

    api
      .get<Summary>(`/campaigns/${campaignId}/journal/since-last-visit`, token)
      .then((data) => {
        if (cancelled) return;
        if (!data.firstVisit && (data.totalNew > 0 || (data.gameMinutesElapsed ?? 0) >= MIN_GAME_MINUTES)) {
          setSummary(data);
        }
      })
      .catch(() => undefined)
      .finally(() => void markVisit());

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void markVisit();
    }, HEARTBEAT_MS);
    // Ao sair, marca a visita mesmo com a página fechando.
    const onLeave = () => {
      void fetch(`${API_URL}/campaigns/${campaignId}/journal/visit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", onLeave);
    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [campaignId, token]);

  const WeatherIcon = summary ? WEATHER_ICONS[summary.weather] : null;

  return (
    <AnimatePresence>
      {summary ? (
        <motion.section
          aria-labelledby="return-chronicle-title"
          className="parchment rounded-xl border-2 border-[var(--rpg-bronze)] bg-[var(--rpg-parchment)] px-5 py-4 text-[var(--rpg-charcoal)] shadow-xl shadow-black/30"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(20_23_21/0.7)]">
                Sua última visita foi {describeRealTime(summary.lastSeenAt)}
              </p>
              <h2 id="return-chronicle-title" className="font-heading text-2xl">
                Enquanto você esteve fora…
              </h2>
            </div>
            <Button className="h-11" onClick={() => setSummary(null)}>
              Voltar à mesa
            </Button>
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-[family-name:var(--font-body)] text-base">
            {summary.gameMinutesElapsed ? (
              <li className="flex items-center gap-1.5">
                <Hourglass className="size-4" aria-hidden="true" /> {describeGameTime(summary.gameMinutesElapsed)}.
              </li>
            ) : null}
            {WeatherIcon ? (
              <li className="flex items-center gap-1.5">
                <WeatherIcon className="size-4" aria-hidden="true" /> Agora: {WEATHER_LABELS[summary.weather].toLowerCase()}.
              </li>
            ) : null}
          </ul>

          {summary.entries.length > 0 ? (
            <>
              <h3 className="mt-3 text-sm font-semibold">
                {summary.totalNew === 1 ? "1 novidade no diário" : `${summary.totalNew} novidades no diário`}
              </h3>
              <ol className="mt-1 flex flex-col gap-2">
                {summary.entries.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-[rgb(20_23_21/0.15)] bg-[rgb(255_255_255/0.35)] px-3 py-2">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(20_23_21/0.7)]">
                      {JOURNAL_CATEGORY_LABELS[entry.category]}
                      {entry.restricted ? <span className="rounded bg-[var(--rpg-wine)] px-1.5 py-0.5 text-white normal-case tracking-normal">revelação para você</span> : null}
                    </p>
                    <p className="font-heading text-lg">{entry.title}</p>
                    <p className="font-[family-name:var(--font-body)] text-base leading-6">{entry.excerpt}</p>
                  </li>
                ))}
              </ol>
              {summary.totalNew > summary.entries.length ? (
                <p className="mt-1 text-sm text-[rgb(20_23_21/0.7)]">E mais {summary.totalNew - summary.entries.length} no diário.</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-[rgb(20_23_21/0.7)]">Nada novo foi registrado no diário.</p>
          )}

          <Link
            href={`/campaigns/${campaignId}/journal`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
          >
            <ScrollText className="size-4" aria-hidden="true" /> Abrir o diário completo
          </Link>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
