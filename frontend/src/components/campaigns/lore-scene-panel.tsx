"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { useStoryUpdates } from "@/lib/use-story-updates";
import { useWorldCalendarStore } from "@/stores/world-calendar-store";
import type { CampaignCalendar } from "@/lib/types";

export function LoreScenePanel({ campaignId }: { campaignId: string }) {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const [scene, setScene] = useState<{
    place: { name: string };
    participants: { id: string; name: string; userId: string }[];
  } | null>(null);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [characterId, setCharacterId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!token) return;
    const seq = ++generation.current;
    try {
      const s = await api.get<{
        installed: boolean;
        scene?: NonNullable<typeof scene>;
      }>(`/campaigns/${campaignId}/lore/state`, token);
      if (!s.installed || !s.scene) return;
      const [owned, clock] = await Promise.all([
        api.get<{ id: string; name: string }[]>("/characters", token),
        api.get<CampaignCalendar>(
          `/campaigns/${campaignId}/world/calendar`,
          token,
        ),
      ]);
      if (active.current && seq === generation.current) {
        setScene(s.scene);
        setCharacters(owned);
        useWorldCalendarStore.getState().setCalendar(campaignId, clock);
      }
    } catch {
      if (active.current && seq === generation.current) setScene(null);
    }
  }, [campaignId, token]);
  useStoryUpdates(campaignId, scene ? token : null, refresh);
  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(refresh);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => {
      active.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  if (!scene) return null;
  async function attach() {
    setBusy(true);
    setError("");
    try {
      await api.post(
        `/campaigns/${campaignId}/lore/characters`,
        { characterId },
        token,
      );
      const state = await api.get<{ scene: NonNullable<typeof scene> }>(
        `/campaigns/${campaignId}/lore/state`,
        token,
      );
      setScene(state.scene);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível vincular o personagem.",
      );
    } finally {
      setBusy(false);
    }
  }
  const own = scene.participants.filter((p) => p.userId === userId);
  return (
    <section className="rounded-xl border border-primary/30 bg-card/80 p-4">
      <h2 className="font-heading text-lg">
        Cena do grupo: {scene.place.name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Abrir outro mapa não muda este lugar. Viagens e descansos são
        confirmados em Comandos do grupo.
      </p>
      <Link
        className="mt-2 inline-flex min-h-10 items-center text-sm text-primary"
        href={`/campaigns/${campaignId}/actions`}
      >
        Abrir comandos do grupo →
      </Link>
      <p className="mt-2 text-sm">
        {scene.participants.length
          ? scene.participants.map((p) => p.name).join(", ")
          : "Nenhum personagem vinculado à cena."}
      </p>
      {own.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="lore-character">
            Seu personagem para esta campanha
          </label>
          <select
            id="lore-character"
            className="max-w-full rounded border border-input bg-background p-2 text-sm"
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
          >
            <option value="">Escolha seu personagem</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button disabled={!characterId || busy} onClick={attach}>
            {busy ? "Vinculando…" : "Vincular à campanha"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
