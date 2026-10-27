export interface CatalogBinding {
  source: string;
  srdIndex: string;
}
export interface PublicLore {
  title: string;
  premise: string;
  tone: string;
  hooks: string[];
  playerHistoryPolicy: string;
  opening: string;
  start: {
    year: number;
    month: number;
    monthName: string;
    day: number;
    hour: number;
    minute: number;
  };
  party: {
    minPlayers: number;
    maxPlayers: number;
    startLevel: number;
    endLevel: number;
  };
}
export interface Manifest {
  formatVersion: 1;
  packId: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED';
  files: { path: string; sha256: string; audience: 'PUBLIC' | 'MASTER' }[];
  sources: { title: string; reference: string; sha256: string | null }[];
  rules: {
    profile: 'SRD_2014';
    combat: 'MANUAL';
    moneyEnabled: false;
    publicationBlockers: string[];
  };
}
export interface Entities {
  places: {
    id: string;
    name: string;
    parentId: string | null;
    description: string;
  }[];
  factions: { id: string; name: string; objective: string; limits: string }[];
  npcs: {
    id: string;
    name: string;
    placeId: string;
    factionId: string | null;
    objective: string;
    voice: string;
    knowledgeBoundary: string;
    catalog: CatalogBinding;
  }[];
  objects: { id: string; name: string; placeId: string; state: string }[];
  relations: {
    from: string;
    to: string;
    kind: 'TRUSTS' | 'FRIEND' | 'RESPECTS' | 'OWES_PAYMENT' | 'DISTRUSTS';
  }[];
}
export interface Facts {
  facts: {
    id: string;
    text: string;
    mutability: 'FIXED' | 'INITIAL_STATE';
    audience: 'PUBLIC' | 'MASTER';
    subjects: string[];
  }[];
  claims: {
    id: string;
    text: string;
    truth: 'FALSE' | 'TRUE' | 'TRUE_IMPRECISE';
    factIds: string[];
  }[];
  knowledge: {
    npcId: string;
    targetId: string;
    stance: 'KNOWS' | 'BELIEVES' | 'SUSPECTS';
    source: string;
  }[];
  improvisation: { allowed: string[]; requiresValidatedEvent: string[] };
}
export type History = {
  id: string;
  timeLabel: string;
  relativeMinutes: number | null;
  precision: 'APPROXIMATE_YEARS' | 'DAY' | 'MINUTE';
  text: string;
  audience: 'PUBLIC' | 'MASTER';
  knowledgeNote: string;
}[];
export interface Threads {
  threads: {
    id: string;
    objective: string;
    completion: string;
    consequence: string;
  }[];
  clues: {
    id: string;
    conclusion: string;
    factIds: string[];
    alternatives: { holderId: string; text: string }[];
  }[];
  pressures: {
    id: string;
    afterMinutes: number;
    afterEventId: string | null;
    condition: string;
    effect: string;
    subjects: string[];
  }[];
  repairs: {
    id: string;
    placeId: string;
    objectId: string;
    minutes: number;
    conditions: string[];
    effect: string;
  }[];
  rewards: {
    threadId: string;
    kind: 'LODGING' | 'MONEY';
    quantity: number | null;
    unit: 'DAYS' | 'UNDEFINED';
    beneficiary: 'GROUP';
    enabled: boolean;
  }[];
  resolutions: string[];
  guidance: string[];
}
export interface Route {
  from: string;
  to: string;
  minutes: number;
  bidirectional: true;
}
export interface Atlas {
  geometry: {
    mapId: string;
    walls: import('../vtt/vision').Wall[];
    entry: { x: number; y: number };
  }[];
  coordinateSystem: string;
  maps: {
    id: string;
    name: string;
    kind: 'REGION' | 'SETTLEMENT' | 'INTERIOR';
    parentId: string | null;
    width: number;
    height: number;
    gridSize: number;
    asset: string;
    texture: string;
    visibility: 'PUBLIC_AT_START' | 'KNOWN_PLAN_ON_DISCOVERY';
    scale: string;
  }[];
  places: {
    id: string;
    name: string;
    mapId: string;
    x: number;
    y: number;
    targetMapId: string | null;
  }[];
  rooms: {
    id: string;
    mapId: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  routes: Route[];
  localTravel: Route[];
}
export type Encounters = {
  id: string;
  placeId: string | null;
  catalog: CatalogBinding;
  availability: 'LATER_ARC' | 'OPTIONAL';
  resolution: 'MANUAL';
  usage: string;
}[];
export interface LorePack {
  manifest: Manifest;
  public: PublicLore;
  entities: Entities;
  facts: Facts;
  history: History;
  threads: Threads;
  atlas: Atlas;
  encounters: Encounters;
}
export interface LoreIssue {
  code: string;
  path: string;
  message: string;
}
export interface ResolvedBinding extends CatalogBinding {
  entityId: string;
  kind: 'NPC' | 'CREATURE';
  status: 'RESOLVED' | 'MISSING' | 'AMBIGUOUS';
  monsterId: string | null;
  name: string | null;
}
