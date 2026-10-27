"use client";
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getSocketUrl } from "./realtime";

// The socket only invalidates. Authorized HTTP snapshots remain the source of truth.
export function useStoryUpdates(
  campaignId: string,
  token: string | null,
  onUpdate: () => void,
) {
  const listener = useRef(onUpdate);
  useEffect(() => {
    listener.current = onUpdate;
  }, [onUpdate]);
  useEffect(() => {
    if (!token) return;
    const socket = io(getSocketUrl("/vtt"), { auth: { token } });
    const seen = new Set<string>();
    socket.on("connect", () =>
      socket.emit("vtt:join", { campaignId, presence: false }),
    );
    socket.on("vtt:joined", () => listener.current());
    socket.on(
      "story:updated",
      (event: { campaignId: string; eventId: string }) => {
        if (event.campaignId !== campaignId || seen.has(event.eventId)) return;
        seen.add(event.eventId);
        if (seen.size > 128) seen.delete(seen.values().next().value!);
        listener.current();
      },
    );
    socket.on("vtt:error", () => listener.current());
    return () => {
      socket.emit("vtt:leave", { campaignId });
      socket.disconnect();
    };
  }, [campaignId, token]);
}
