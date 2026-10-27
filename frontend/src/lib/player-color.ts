// Cor estável de cada participante da mesa (dados, presença e pings). Todas
// mantêm contraste ≥ 7:1 com a tinta escura dos números (#141715).
export const PLAYER_COLORS = [
  { name: "bronze", hex: "#d6a86a" },
  { name: "pergaminho", hex: "#e6d9b8" },
  { name: "musgo", hex: "#a9bf96" },
  { name: "rosa antigo", hex: "#d9a3a8" },
  { name: "ardósia", hex: "#aebdcf" },
  { name: "âmbar", hex: "#e8c15c" },
  { name: "lavanda", hex: "#c3b3d9" },
  { name: "turquesa", hex: "#8fc9c0" },
] as const;

export function playerColor(userId: string | null | undefined): string {
  if (!userId) return PLAYER_COLORS[0].hex;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length].hex;
}
