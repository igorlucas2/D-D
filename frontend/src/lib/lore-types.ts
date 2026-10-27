export interface PublicLorePack {
  packId: string; version: string; status: "DRAFT" | "PUBLISHED";
  title: string; premise: string; tone: string; hooks: string[]; opening: string;
  party: { minPlayers: number; maxPlayers: number; startLevel: number; endLevel: number };
}
export interface LorePreview {
  pack: PublicLorePack & {contentHash:string};
  validation: { catalogValid: boolean; campaignEligible: boolean; canInstall: boolean; canInstallPlaytest:boolean; conflicts: { code: string; message: string }[]; warnings: string[] };
  counts: { npcs: number; creatures: number; places: number; factions: number; facts: number; threads: number; maps: number };
  bindings: { entityId: string; kind: "NPC" | "CREATURE"; status: "RESOLVED" | "MISSING" | "AMBIGUOUS"; name: string | null }[];
  sources: { title: string; reference: string }[];
  review: {
    entities: {
      places: { id: string; name: string; description: string }[];
      npcs: { id: string; name: string; placeId: string; objective: string; voice: string; knowledgeBoundary: string }[];
      factions: { id: string; name: string; objective: string; limits: string }[];
    };
    facts: { facts: { id: string; text: string; audience: "PUBLIC" | "MASTER"; mutability: "FIXED" | "INITIAL_STATE" }[] };
    history: { id: string; timeLabel: string; text: string }[];
    threads: {
      threads: { id: string; objective: string; completion: string; consequence: string }[];
      clues: { id: string; conclusion: string; alternatives: { holderId: string; text: string }[] }[];
      pressures: { id: string; afterMinutes: number; afterEventId: string | null; condition: string; effect: string }[];
      repairs: { id: string; placeId: string; minutes: number; conditions: string[]; effect: string }[];
      guidance: string[];
    };
    atlas: { maps: { id: string; name: string; width: number; height: number; visibility: string }[]; routes: { from: string; to: string; minutes: number }[] };
    encounters: { id: string; placeId: string | null; availability: string; usage: string }[];
  };
}
