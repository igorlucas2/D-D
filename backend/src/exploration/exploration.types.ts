export interface SerializedExplorationState {
  characterId: string;
  campaignId: string;
  currentMapId: string | null;
  actionPoints: number;
  maxActionPoints: number;
  fatigue: number;
  lastRestAtMinutes: number;
}
