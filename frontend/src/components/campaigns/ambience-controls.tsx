"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ambienceEngine } from "@/lib/audio/ambience-engine";
import { AMBIENCE_PRESET_LABELS, type AmbiencePreset } from "@/lib/audio/ambience-presets";
import { WEATHER_PARTICLE_LABELS, type Weather, type WeatherParticles } from "@/lib/weather";
import { useTablePrefsStore } from "@/stores/table-prefs-store";
import { useAudioPrefsStore } from "@/stores/audio-prefs-store";

const subscribe = (listener: () => void) => ambienceEngine.subscribe(listener);

function useEngineRunning() {
  return useSyncExternalStore(subscribe, () => ambienceEngine.running, () => false);
}

function useActiveAmbience() {
  return useSyncExternalStore(subscribe, () => ambienceEngine.activeKey, () => null);
}

/**
 * Toca a paisagem do mapa atual (IM-02). O som só começa após um gesto do
 * usuário; quem já tinha ativado volta a ouvir no primeiro clique ou tecla.
 */
export function useAmbience(preset: AmbiencePreset | "combat" | null, night: boolean, weather: Weather = "clear", indoor = false) {
  const enabled = useAudioPrefsStore((state) => state.enabled);
  const volume = useAudioPrefsStore((state) => state.volume);
  const sfxVolume = useAudioPrefsStore((state) => state.sfxVolume);
  const running = useEngineRunning();

  useEffect(() => {
    ambienceEngine.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    ambienceEngine.setSfxVolume(sfxVolume);
  }, [sfxVolume]);

  useEffect(() => {
    if (!enabled || running) return;
    const resume = () => void ambienceEngine.start();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, [enabled, running]);

  useEffect(() => {
    if (enabled && running && preset) ambienceEngine.play(preset, night, weather, indoor);
  }, [enabled, running, preset, night, weather, indoor]);

  // Sair da mesa encerra o som; a preferência continua salva.
  useEffect(() => () => ambienceEngine.stop(0.4), []);
}

export function AmbienceControls({ preset }: { preset: AmbiencePreset | null }) {
  const enabled = useAudioPrefsStore((state) => state.enabled);
  const volume = useAudioPrefsStore((state) => state.volume);
  const setEnabled = useAudioPrefsStore((state) => state.setEnabled);
  const setVolume = useAudioPrefsStore((state) => state.setVolume);
  const sfxVolume = useAudioPrefsStore((state) => state.sfxVolume);
  const setSfxVolume = useAudioPrefsStore((state) => state.setSfxVolume);
  const running = useEngineRunning();
  const activeKey = useActiveAmbience();
  const playing = enabled && running;
  const particles = useTablePrefsStore((state) => state.weatherParticles);
  const setParticles = useTablePrefsStore((state) => state.setWeatherParticles);

  async function toggle() {
    if (playing) {
      setEnabled(false);
      await ambienceEngine.pause();
      return;
    }
    await ambienceEngine.start();
    setEnabled(true);
  }

  return (
    <div className="flex items-center gap-2" data-ambience={playing ? activeKey ?? "" : "off"}>
      <Button
        variant={playing ? "default" : "outline"}
        className="h-11"
        aria-pressed={playing}
        title={preset && playing ? `Ambiente: ${AMBIENCE_PRESET_LABELS[preset]}` : undefined}
        onClick={() => void toggle()}
      >
        {playing ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
        {playing ? "Som" : enabled ? "Retomar som" : "Ativar som"}
      </Button>
      {playing ? (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {[
            { label: "Ambiente", value: volume, set: setVolume },
            { label: "Efeitos", value: sfxVolume, set: setSfxVolume },
          ].map((channel) => (
            <label key={channel.label} className="flex items-center gap-1.5">
              <span className="w-14">{channel.label}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(channel.value * 100)}
                onChange={(event) => channel.set(Number(event.target.value) / 100)}
                aria-label={`Volume ${channel.label === "Ambiente" ? "do ambiente" : "dos efeitos"}`}
                aria-valuetext={`${Math.round(channel.value * 100)}%`}
                className="h-5 w-20 accent-[var(--rpg-bronze)]"
              />
            </label>
          ))}
        </div>
      ) : null}
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Clima
        <select
          aria-label="Partículas de clima"
          value={particles ?? ""}
          onChange={(event) => setParticles(event.target.value as WeatherParticles)}
          className="h-9 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {particles === null ? <option value="">automático</option> : null}
          {(Object.keys(WEATHER_PARTICLE_LABELS) as WeatherParticles[]).map((option) => (
            <option key={option} value={option}>
              {WEATHER_PARTICLE_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
