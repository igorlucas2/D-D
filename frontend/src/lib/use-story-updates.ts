"use client";
import { useEffect, useRef } from "react";
import { acquireVtt } from "./realtime-client";

interface StoryListen {
  "vtt:joined": (payload: { campaignId: string }) => void;
  "story:updated": (payload: { campaignId: string; eventId: string }) => void;
  "table:state": (payload: { campaignId: string }) => void;
  "vtt:error": (payload: { message: string }) => void;
}

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
    const channel = acquireVtt<StoryListen, Record<string, never>>(token);
    channel.join(campaignId);
    const seen = new Set<string>();
    channel.on("vtt:joined", () => listener.current());
    channel.on("story:updated", (event) => {
      if (event.campaignId !== campaignId || seen.has(event.eventId)) return;
      seen.add(event.eventId);
      if (seen.size > 128) seen.delete(seen.values().next().value!);
      listener.current();
    });
    channel.on("table:state", (event) => {
      if (event.campaignId === campaignId) listener.current();
    });
    channel.on("vtt:error", () => listener.current());
    return () => channel.close();
  }, [campaignId, token]);
}
