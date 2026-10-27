"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye } from "lucide-react";
import { playerColor } from "@/lib/player-color";

export interface PresenceMember {
  userId: string;
  displayName: string;
  role: "master" | "player";
  status: "online" | "away";
}

export interface TablePing {
  /** Identificador local, para animar e remover. */
  key: number;
  userId: string;
  displayName: string;
  mapId: string;
  x: number;
  y: number;
  focus: boolean;
}

export const PING_SECONDS = 2.6;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

interface PresenceBarProps {
  members: PresenceMember[];
  connection: "connected" | "reconnecting";
  isMaster: boolean;
  followMaster: boolean;
  onFollowChange: (value: boolean) => void;
}

// Quem está com a mesa aberta agora (IM-05). Estado sempre em texto, não só cor.
export function PresenceBar({ members, connection, isMaster, followMaster, onFollowChange }: PresenceBarProps) {
  const online = members.filter((member) => member.status === "online").length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {connection === "reconnecting" ? (
        <p role="status" className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          Reconectando… alterações de outros jogadores podem estar atrasadas.
        </p>
      ) : null}
      <ul aria-label={`Na mesa: ${online} online de ${members.length}`} className="flex flex-wrap items-center gap-1.5">
        {members.map((member) => {
          const away = member.status === "away";
          const label = `${member.displayName} · ${member.role === "master" ? "mestre" : "jogador"} · ${away ? "ausente" : "online"}`;
          return (
            <li key={member.userId} title={label} aria-label={label} className="relative">
              <span
                className={`flex size-9 items-center justify-center rounded-full border-2 text-xs font-semibold text-[var(--rpg-charcoal)] ${away ? "opacity-45" : ""}`}
                style={{ backgroundColor: playerColor(member.userId), borderColor: member.role === "master" ? "var(--rpg-bronze)" : "transparent" }}
              >
                {initials(member.displayName)}
              </span>
              <span
                aria-hidden="true"
                className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card ${away ? "bg-muted-foreground" : "bg-[var(--rpg-moss)]"}`}
              />
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted-foreground">
        {online} online{members.length > online ? ` · ${members.length - online} ausente${members.length - online > 1 ? "s" : ""}` : ""}
      </span>
      {!isMaster ? (
        <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={followMaster}
            onChange={(event) => onFollowChange(event.target.checked)}
            className="size-4 accent-[var(--rpg-bronze)]"
          />
          <Eye className="size-3.5" aria-hidden="true" /> Seguir o mestre quando ele pedir “Olhem aqui”
        </label>
      ) : null}
    </div>
  );
}

// Ondas de ping sobre o mapa 2D, na cor de quem apontou.
export function PingLayer({ pings, width, height }: { pings: TablePing[]; width: number; height: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <AnimatePresence>
        {pings.map((ping) => {
          const color = playerColor(ping.userId);
          return (
            <motion.div
              key={ping.key}
              // Âncora sem tamanho exatamente no centro da célula; anéis, ponto e
              // nome se posicionam a partir dela.
              className="absolute size-0"
              style={{ left: `${((ping.x + 0.5) / width) * 100}%`, top: `${((ping.y + 0.5) / height) * 100}%` }}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {(reduceMotion ? [0] : [0, 0.45, 0.9]).map((delay) => (
                <motion.span
                  key={delay}
                  className="absolute -top-5 -left-5 size-10 rounded-full border-4"
                  style={{ borderColor: color }}
                  initial={{ scale: reduceMotion ? 1 : 0.3, opacity: 0.95 }}
                  animate={reduceMotion ? { opacity: [0.95, 0.95, 0] } : { scale: 2.4, opacity: 0 }}
                  transition={{ duration: reduceMotion ? PING_SECONDS : 1.2, delay, repeat: reduceMotion ? 0 : 1 }}
                />
              ))}
              <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full ring-2 ring-[var(--rpg-charcoal)]" style={{ backgroundColor: color }} />
              <span className="absolute top-6 left-0 -translate-x-1/2 whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-xs font-medium text-foreground shadow">
                {ping.focus ? `${ping.displayName}: olhem aqui` : ping.displayName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
