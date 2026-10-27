import type { DayPhaseStyle } from "@/lib/day-phase";

// Tom da fase do dia sobre a imagem do mapa 2D. Fica abaixo da grade, fog,
// tokens e marcadores para não reduzir o contraste dos elementos de jogo.
export function DayNightOverlay({ lighting }: { lighting: DayPhaseStyle }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 transition-[background-color,opacity] duration-[1500ms] ease-in-out motion-reduce:transition-none"
      style={{
        backgroundColor: lighting.overlay?.color ?? "transparent",
        opacity: lighting.overlay?.opacity ?? 0,
      }}
    />
  );
}
