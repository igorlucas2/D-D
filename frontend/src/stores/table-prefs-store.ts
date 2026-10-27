import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WeatherParticles } from "@/lib/weather";

export type DiceAnimation = "physics" | "result";

// Preferências de conforto da mesa, salvas apenas neste navegador.
interface TablePrefsState {
  /** null = ainda não escolhido; segue `prefers-reduced-motion`. */
  diceAnimation: DiceAnimation | null;
  /** Jogador aceita que "Olhem aqui" do mestre mova a sua visão. */
  followMaster: boolean;
  /** null = automático: reduzidas no celular e com movimento reduzido. */
  weatherParticles: WeatherParticles | null;
  setDiceAnimation: (value: DiceAnimation) => void;
  setWeatherParticles: (value: WeatherParticles) => void;
  setFollowMaster: (value: boolean) => void;
}

export const useTablePrefsStore = create<TablePrefsState>()(
  persist(
    (set) => ({
      diceAnimation: null,
      followMaster: true,
      weatherParticles: null,
      setDiceAnimation: (diceAnimation) => set({ diceAnimation }),
      setWeatherParticles: (weatherParticles) => set({ weatherParticles }),
      setFollowMaster: (followMaster) => set({ followMaster }),
    }),
    { name: "rpg-table-prefs" },
  ),
);
