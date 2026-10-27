"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/lib/api";
import { acquireWorld } from "@/lib/realtime-client";
import type { CampaignCalendar, WorldEventTriggered } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

interface ServerToClientEvents {
  connect: () => void;
  "world:joined": (payload: { campaignId: string }) => void;
  "world:clock:updated": (calendar: CampaignCalendar) => void;
  "world:error": (payload: { message: string }) => void;
  "world:event:triggered": (payload: WorldEventTriggered) => void;
}

interface ClientToServerEvents {
  "world:join": (payload: { campaignId: string }) => void;
  "world:leave": (payload: { campaignId: string }) => void;
}

/** `key` muda a cada evento, para a interface reagir mesmo a títulos repetidos. */
export type LiveWorldEvent = WorldEventTriggered & { key: number };

interface WorldCalendarState {
  calendars: Record<string, CampaignCalendar>;
  errors: Record<string, string | null>;
  events: Record<string, LiveWorldEvent | null>;
  pushEvent: (campaignId: string, event: WorldEventTriggered) => void;
  setCalendar: (campaignId: string, calendar: CampaignCalendar) => void;
  setError: (campaignId: string, error: string | null) => void;
}

export const useWorldCalendarStore = create<WorldCalendarState>((set) => ({
  calendars: {},
  errors: {},
  events: {},
  pushEvent: (campaignId, event) =>
    set((state) => ({ events: { ...state.events, [campaignId]: { ...event, key: Date.now() } } })),
  setCalendar: (campaignId, calendar) =>
    set((state) => ({ calendars: { ...state.calendars, [campaignId]: calendar } })),
  setError: (campaignId, error) =>
    set((state) => ({ errors: { ...state.errors, [campaignId]: error } })),
}));

// Relógio, mesa e exploração leem o mesmo calendário: uma única conexão por
// campanha, liberada quando o último componente desmonta.
const subscriptions = new Map<string, { count: number; release: () => void }>();

function subscribe(campaignId: string, token: string) {
  const key = `${campaignId}:${token}`;
  const existing = subscriptions.get(key);
  if (existing) {
    existing.count += 1;
    return key;
  }

  const { setCalendar, setError } = useWorldCalendarStore.getState();
  let cancelled = false;

  const load = () =>
    api
      .get<CampaignCalendar>(`/campaigns/${campaignId}/world/calendar`, token)
      .then((data) => {
        if (!cancelled) setCalendar(campaignId, data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(campaignId, err instanceof ApiError ? err.message : "Erro ao carregar o relógio do mundo.");
        }
      });

  const channel = acquireWorld<ServerToClientEvents, ClientToServerEvents>(token);
  channel.join(campaignId);
  void load();
  let connectedBefore = false;
  channel.on("connect", () => {
    // Avanços ocorridos enquanto desconectado não são reenviados pelo servidor.
    if (connectedBefore) void load();
    connectedBefore = true;
  });
  channel.on("world:clock:updated", (updated) => setCalendar(campaignId, updated));
  channel.on("world:error", ({ message }) => setError(campaignId, message));
  channel.on("world:event:triggered", (event) => useWorldCalendarStore.getState().pushEvent(campaignId, event));

  subscriptions.set(key, {
    count: 1,
    release: () => {
      cancelled = true;
      channel.close();
    },
  });
  return key;
}

function unsubscribe(key: string) {
  const entry = subscriptions.get(key);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  entry.release();
  subscriptions.delete(key);
}

export function useWorldCalendar(campaignId: string) {
  const token = useAuthStore((state) => state.token);
  const calendar = useWorldCalendarStore((state) => state.calendars[campaignId] ?? null);
  const error = useWorldCalendarStore((state) => state.errors[campaignId] ?? null);
  const lastEvent = useWorldCalendarStore((state) => state.events[campaignId] ?? null);
  const setCalendarFor = useWorldCalendarStore((state) => state.setCalendar);
  const setErrorFor = useWorldCalendarStore((state) => state.setError);

  useEffect(() => {
    if (!token) return;
    const key = subscribe(campaignId, token);
    return () => unsubscribe(key);
  }, [campaignId, token]);

  return {
    calendar,
    error,
    lastEvent,
    setCalendar: (updated: CampaignCalendar) => setCalendarFor(campaignId, updated),
    setError: (message: string | null) => setErrorFor(campaignId, message),
  };
}
