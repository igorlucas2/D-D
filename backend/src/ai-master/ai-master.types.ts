export interface AiTurnCharacter {
  entityId: string;
  name: string;
  hp: { current: number; max: number; temp: number };
  armorClass: number;
  conditions: string[];
}

export interface AiTurnContext {
  campaign: { name: string };
  scene: {
    name: string;
    phase: string;
    gameMinute: number;
    weather: string;
  } | null;
  player: { character: string | null };
  characters: AiTurnCharacter[];
  facts: Array<{
    text: string;
    classification: 'FIXED' | 'MUTABLE' | 'RUMOR';
  }>;
  recent: Array<{ sequence: number; gameMinute: number; summary: string }>;
  action: string;
  rules: string[];
}

export interface AiTurnState {
  mode: 'OFF' | 'COPILOT' | 'AUTONOMOUS';
  paused: boolean;
  revision: number;
  isMaster: boolean;
  storyReady: boolean;
  scene: {
    name: string;
    phase: string;
    gameMinute: number;
    weather: string;
  } | null;
  characters: Array<{
    id: string;
    characterId: string;
    name: string;
    isMine: boolean;
    currentHp: number;
    maxHp: number;
    tempHp: number;
    armorClass: number;
    conditions: string[];
    items: Array<{
      inventoryItemId: string;
      itemId: string;
      name: string;
      quantity: number;
      category: string;
      properties: string | null;
      description: string | null;
      effectKind: 'HEAL' | 'TEMP_HP' | 'DAMAGE' | null;
    }>;
  }>;
  events: Array<{
    eventId: string;
    sequence: number;
    gameMinute: number;
    summary: string;
    narration: string | null;
  }>;
  provider: {
    available: boolean;
    model: string;
    reason?: string;
  };
}
