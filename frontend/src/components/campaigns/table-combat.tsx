"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Swords } from "lucide-react";
import { api } from "@/lib/api";
import { HP_STATUS_LABELS, type Character, type CombatEncounter, type CombatEvent, type CombatParticipant, type VttToken } from "@/lib/types";

// Combate em cena (IM-07): banner de turno, números de dano/cura sobre o token,
// vinheta de PV baixo do próprio personagem. Tudo também vira texto no
// anúncio para leitor de tela: os efeitos reforçam, não substituem.

export interface CombatFloat {
  key: number;
  participantId: string;
  text: string;
  kind: "damage" | "heal" | "status";
}

export interface TurnBanner {
  key: number;
  title: string;
  subtitle: string;
}

const FLOAT_SECONDS = 1.8;
const BANNER_SECONDS = 1.6;

export function useTableCombat(campaignId: string, token: string | null) {
  const [encounter, setEncounter] = useState<CombatEncounter | null>(null);
  const [banner, setBanner] = useState<TurnBanner | null>(null);
  const [floats, setFloats] = useState<CombatFloat[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [ownCharacterIds, setOwnCharacterIds] = useState<Set<string>>(new Set());
  const counter = useRef(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<CombatEncounter | null>(`/campaigns/${campaignId}/combat`, token)
      .then((data) => !cancelled && setEncounter(data))
      .catch(() => undefined);
    api
      .get<Character[]>("/characters", token)
      .then((characters) => !cancelled && setOwnCharacterIds(new Set(characters.map((c) => c.id))))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [campaignId, token]);

  const reload = useCallback(() => {
    if (!token) return;
    api.get<CombatEncounter | null>(`/campaigns/${campaignId}/combat`, token).then(setEncounter).catch(() => undefined);
  }, [campaignId, token]);

  const showBanner = useCallback((title: string, subtitle: string) => {
    const key = ++counter.current;
    setBanner({ key, title, subtitle });
    window.setTimeout(() => setBanner((current) => (current?.key === key ? null : current)), BANNER_SECONDS * 1000);
  }, []);

  const receive = useCallback(
    (payload: { encounter: CombatEncounter | null; event: CombatEvent | null }) => {
      setEncounter(payload.encounter);
      const event = payload.event;
      if (!event) return;
      const find = (id: string) => payload.encounter?.participants.find((item) => item.id === id);

      if (event.type === "start") {
        showBanner("Rolem iniciativa!", payload.encounter?.name ?? "Combate");
        setAnnouncement(`Combate iniciado: ${payload.encounter?.name ?? ""}`);
      } else if (event.type === "end") {
        showBanner("Fim do combate", "");
        setAnnouncement("Combate encerrado.");
      } else if (event.type === "turn") {
        const who = find(event.participantId);
        if (who) {
          showBanner(`Vez de ${who.name}`, `Rodada ${event.round}`);
          setAnnouncement(`Rodada ${event.round}. Vez de ${who.name}.`);
        }
      } else if (event.type === "hp") {
        const who = find(event.participantId);
        if (!who) return;
        const status = HP_STATUS_LABELS[event.hpStatus];
        const float: CombatFloat = {
          key: ++counter.current,
          participantId: event.participantId,
          kind: event.delta === null ? "status" : event.delta < 0 ? "damage" : "heal",
          text: event.delta === null ? status : `${event.delta > 0 ? "+" : "−"}${Math.abs(event.delta)}`,
        };
        setFloats((current) => [...current, float]);
        window.setTimeout(() => setFloats((current) => current.filter((item) => item.key !== float.key)), FLOAT_SECONDS * 1000);
        setAnnouncement(
          event.delta === null
            ? `${who.name}: ${status}.`
            : `${who.name} ${event.delta < 0 ? "sofreu" : "recuperou"} ${Math.abs(event.delta)} de vida (${status}).`,
        );
      }
    },
    [showBanner],
  );

  // Vinheta só para o próprio personagem, e só com PV numérico (aliados sempre têm).
  const own = encounter?.participants.find((item) => item.characterId && ownCharacterIds.has(item.characterId));
  const ownRatio = own && own.currentHp !== null && own.maxHp ? own.currentHp / own.maxHp : null;
  const danger: "none" | "low" | "down" = ownRatio === null ? "none" : ownRatio <= 0 ? "down" : ownRatio <= 0.25 ? "low" : "none";

  return { encounter, banner, floats, announcement, danger, receive, reload };
}

/** Participante representado por um token: pelo personagem ou pelo nome. */
export function participantForToken(encounter: CombatEncounter | null, token: VttToken): CombatParticipant | null {
  if (!encounter) return null;
  return (
    encounter.participants.find((item) => item.characterId && item.characterId === token.characterId) ??
    encounter.participants.find((item) => !item.characterId && item.name.trim().toLowerCase() === token.name.trim().toLowerCase()) ??
    null
  );
}

export function TurnBannerView({ banner }: { banner: TurnBanner | null }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {banner ? (
        <motion.div
          key={banner.key}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-4"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.3 }}
        >
          <div className="flex items-center gap-3 rounded-xl border-2 border-[var(--rpg-wine)] bg-[rgb(20_23_21/0.92)] px-5 py-2 shadow-2xl shadow-black/60">
            <Swords className="size-6 text-[#d9a3a8]" />
            <div>
              <p className="font-heading text-xl text-[var(--rpg-parchment)] sm:text-2xl">{banner.title}</p>
              {banner.subtitle ? <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{banner.subtitle}</p> : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Números sobre os tokens; `positions` traz o centro (em %) de cada participante. */
export function CombatFloatLayer({ floats, positions }: { floats: CombatFloat[]; positions: Map<string, { left: number; top: number }> }) {
  const reduceMotion = useReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
      <AnimatePresence>
        {floats.map((float) => {
          const at = positions.get(float.participantId);
          if (!at) return null;
          const color = float.kind === "damage" ? "text-[#ff9a9f]" : float.kind === "heal" ? "text-[#b9d9a6]" : "text-[var(--rpg-parchment)]";
          return (
            <motion.span
              key={float.key}
              className={`absolute -translate-x-1/2 whitespace-nowrap font-heading text-2xl font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] ${float.kind === "status" ? "text-base" : ""} ${color}`}
              style={{ left: `${at.left}%`, top: `${at.top}%` }}
              initial={{ opacity: 0, y: 0, scale: reduceMotion ? 1 : 0.7 }}
              animate={{ opacity: [0, 1, 1, 0], y: reduceMotion ? 0 : -36, scale: 1 }}
              transition={{ duration: FLOAT_SECONDS, times: [0, 0.15, 0.7, 1] }}
            >
              {float.text}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Bordas vermelhas na tela de quem está com o personagem em perigo. */
export function LowHpVignette({ danger }: { danger: "none" | "low" | "down" }) {
  const reduceMotion = useReducedMotion();
  if (danger === "none") return null;
  const strength = danger === "down" ? 0.55 : 0.35;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
      style={{ boxShadow: `inset 0 0 120px 30px rgba(139, 52, 64, ${strength})` }}
      animate={reduceMotion || danger === "down" ? { opacity: 1 } : { opacity: [0.65, 1, 0.65] }}
      transition={reduceMotion || danger === "down" ? { duration: 0.3 } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
