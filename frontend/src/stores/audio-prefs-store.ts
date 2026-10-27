import { create } from "zustand";
import { persist } from "zustand/middleware";

// Preferências de som do próprio jogador, salvas apenas neste navegador.
interface AudioPrefsState {
  enabled: boolean;
  volume: number;
  sfxVolume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
}

export const useAudioPrefsStore = create<AudioPrefsState>()(
  persist(
    (set) => ({
      enabled: false,
      volume: 0.6,
      sfxVolume: 0.7,
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume: Math.min(1, Math.max(0, sfxVolume)) }),
    }),
    { name: "rpg-audio" },
  ),
);
