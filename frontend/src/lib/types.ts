import type { AmbiencePreset } from "@/lib/audio/ambience-presets";
import type { Weather } from "@/lib/weather";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  accountLevel: number;
  accountXp: number;
}

export interface UserProfile extends AuthUser {
  bio: string | null;
  createdAt: string;
  _count: { characters: number };
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface CampaignMemberUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CampaignMember {
  id: string;
  campaignId: string;
  userId: string;
  role: "MASTER" | "PLAYER";
  joinedAt: string;
  user: CampaignMemberUser;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  masterId: string;
  inviteCode: string;
  createdAt: string;
  master: CampaignMemberUser;
  members: CampaignMember[];
}

export type HpStatus =
  "UNHURT" | "WOUNDED" | "BADLY_WOUNDED" | "NEAR_DEATH" | "DOWN";

export const HP_STATUS_LABELS: Record<HpStatus, string> = {
  UNHURT: "Ileso",
  WOUNDED: "Ferido",
  BADLY_WOUNDED: "Muito ferido",
  NEAR_DEATH: "À beira da morte",
  DOWN: "Caído",
};

export type CombatHpDisplay = "DESCRIPTIVE" | "NUMERIC";

/** Evento que acompanha cada atualização de combate em tempo real. */
export type CombatEvent =
  | { type: "start" | "end" | "roster" | "display" }
  | { type: "turn"; participantId: string; round: number }
  | { type: "conditions"; participantId: string }
  | {
      type: "death";
      participantId: string;
      successes: number;
      failures: number;
      outcome: string;
    }
  | {
      type: "hp";
      participantId: string;
      delta: number | null;
      hpStatus: HpStatus;
    };

export interface CombatParticipant {
  id: string;
  encounterId: string;
  characterId: string | null;
  name: string;
  initiative: number;
  /** null quando o servidor oculta o PV exato deste inimigo ao jogador. */
  maxHp: number | null;
  currentHp: number | null;
  /** PV temporários; ausente em respostas antigas. */
  tempHp?: number;
  hpStatus: HpStatus;
  conditions: string[];
  timedConditions?: string | null;
  damageDefenses?: string | null;
  isAlly: boolean;
  actionUsed?: boolean;
  bonusUsed?: boolean;
  reactionUsed?: boolean;
  deathSuccesses?: number;
  deathFailures?: number;
  isStable?: boolean;
  isDead?: boolean;
  deathSaveUsed?: boolean;
  x?: number | null;
  y?: number | null;
  speed?: number;
  movementUsed?: number;
}

export interface CombatEncounter {
  id: string;
  campaignId: string;
  name: string;
  round: number;
  turnIndex: number;
  hpDisplay: CombatHpDisplay;
  /** Concorrência otimista (P1-2). */
  revision?: number;
  createdAt: string;
  participants: CombatParticipant[];
}

export interface VttToken {
  id: string;
  mapId: string;
  characterId: string | null;
  /** Dono do personagem; null para NPC/monstro. */
  ownerId: string | null;
  /** Luz emitida e visão no escuro, em células (IM-13). */
  lightRadius: number;
  visionRadius: number;
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  imageUrl: string | null;
  visible: boolean;
}

export interface VttMarker {
  id: string;
  mapId: string;
  x: number;
  y: number;
  label: string;
  color: string;
  note: string | null;
}

export type VttMapKind =
  "WORLD" | "REGION" | "SETTLEMENT" | "BUILDING" | "INTERIOR" | "OTHER";

export const VTT_MAP_KINDS: VttMapKind[] = [
  "WORLD",
  "REGION",
  "SETTLEMENT",
  "BUILDING",
  "INTERIOR",
  "OTHER",
];

export const VTT_MAP_KIND_LABELS: Record<VttMapKind, string> = {
  WORLD: "Mundo",
  REGION: "Regiao",
  SETTLEMENT: "Cidade",
  BUILDING: "Edificio",
  INTERIOR: "Interior",
  OTHER: "Outro",
};

/** Parede ou porta numa borda de célula (coordenadas de quina da grade). */
export interface VttWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  door?: "open" | "closed";
}

export type VttVisionMode = "OFF" | "LIT" | "DARK";

export const VTT_VISION_MODE_LABELS: Record<VttVisionMode, string> = {
  OFF: "Desligada (só a névoa manual)",
  LIT: "Iluminado: paredes bloqueiam a visão",
  DARK: "Escuro: só luz e visão no escuro",
};

export type VttLightingMode = "AUTO" | "INDOOR" | "FIXED_DAY" | "FIXED_NIGHT";

export const VTT_LIGHTING_MODES: VttLightingMode[] = [
  "AUTO",
  "INDOOR",
  "FIXED_DAY",
  "FIXED_NIGHT",
];

export const VTT_LIGHTING_MODE_LABELS: Record<VttLightingMode, string> = {
  AUTO: "Automática (pelo tipo de mapa)",
  INDOOR: "Interior (sem céu)",
  FIXED_DAY: "Sempre dia",
  FIXED_NIGHT: "Sempre noite",
};

export interface VttMapHotspot {
  id: string;
  mapId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  icon: string;
  color: string;
  targetMapId: string | null;
  visibleToPlayers: boolean;
  travelActionCost: number;
  travelMinutes: number;
  eventNote: string | null;
  triggerJournalCategory: JournalCategory | null;
  firstVisitedAt: string | null;
}

export interface VttMap {
  id: string;
  campaignId: string;
  parentMapId: string | null;
  kind: VttMapKind;
  lightingMode: VttLightingMode;
  ambiencePreset: AmbiencePreset | null;
  vision: VttVisionMode;
  walls: VttWall[];
  name: string;
  width: number;
  height: number;
  gridSize: number;
  gridColor: string;
  imageUrl: string | null;
  /** Concorrência otimista (P1-2): enviado como expectedRevision no PATCH. */
  revision?: number;
  createdAt: string;
  updatedAt: string;
  fogCells: string[];
  tokens: VttToken[];
  markers: VttMarker[];
  hotspots: VttMapHotspot[];
}

export type JournalCategory =
  "SESSAO" | "EVENTO" | "MORTE" | "LOOT" | "DECISAO" | "OUTRO";

export const JOURNAL_CATEGORIES: JournalCategory[] = [
  "SESSAO",
  "EVENTO",
  "MORTE",
  "LOOT",
  "DECISAO",
  "OUTRO",
];

export const JOURNAL_CATEGORY_LABELS: Record<JournalCategory, string> = {
  SESSAO: "Sessão",
  EVENTO: "Evento",
  MORTE: "Morte",
  LOOT: "Loot",
  DECISAO: "Decisão",
  OUTRO: "Outro",
};

export interface JournalEntry {
  id: string;
  campaignId: string;
  authorId: string;
  title: string;
  content: string;
  category: JournalCategory;
  sessionDate: string | null;
  /** Revelação visível só ao autor, ao mestre e aos destinatários. */
  restricted: boolean;
  /** Preenchido apenas para o mestre. */
  recipients: { id: string; displayName: string }[];
  createdAt: string;
  updatedAt: string;
  author: CampaignMemberUser;
}

export interface TableNarration {
  id: string;
  title: string | null;
  content: string;
  from: string;
  restricted: boolean;
  journalEntryId: string | null;
  sentAt: string;
}

export interface NarrationDraft {
  id: string;
  campaignId: string;
  mapId: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NarrationSuggestion {
  characterName: string;
  mapName: string;
  drafts: { id: string; title: string }[];
}

export type WorldEntryType =
  "CONTINENTE" | "REINO" | "FACCAO" | "RELIGIAO" | "IDIOMA" | "OUTRO";

export const WORLD_ENTRY_TYPES: WorldEntryType[] = [
  "CONTINENTE",
  "REINO",
  "FACCAO",
  "RELIGIAO",
  "IDIOMA",
  "OUTRO",
];

export const WORLD_ENTRY_TYPE_LABELS: Record<WorldEntryType, string> = {
  CONTINENTE: "Continente",
  REINO: "Reino",
  FACCAO: "Facção",
  RELIGIAO: "Religião",
  IDIOMA: "Idioma",
  OUTRO: "Outro",
};

export interface WorldEntry {
  id: string;
  campaignId: string;
  parentId: string | null;
  type: WorldEntryType;
  name: string;
  summary: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignCalendar {
  monthNames: string[];
  daysPerMonth: number[];
  weekdayNames: string[];
  totalMinutes: number;
  currentDay: number;
  currentMonth: number;
  currentYear: number;
  currentHour: number;
  currentMinute: number;
  currentWeekdayIndex: number;
  notes: string | null;
  realMinutesPerTick: number;
  gameMinutesPerTick: number;
  eventChancePercent: number;
  weather: Weather;
  /** Concorrência otimista (P1-2): enviado como expectedRevision no PUT. */
  revision?: number;
}

/** Evento do mundo sorteado com a mesa aberta (IM-09). */
export interface WorldEventTriggered {
  title: string;
  content: string;
  category: JournalCategory;
  weather: Weather | null;
  journalEntryId: string;
}

export interface WorldEvent {
  id: string;
  campaignId: string;
  title: string;
  content: string;
  category: JournalCategory;
  weight: number;
  isActive: boolean;
  weatherEffect: Weather | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterExplorationState {
  characterId: string;
  campaignId: string;
  currentMapId: string | null;
  actionPoints: number;
  maxActionPoints: number;
  fatigue: number;
  lastRestAtMinutes: number;
}

export interface MonsterFeature {
  name: string;
  description: string;
}

export interface Monster {
  id: string;
  srdIndex?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
  srdUpdatedAt?: string | null;
  name: string;
  type: string;
  size: string;
  armorClass: number;
  maxHp: number;
  speed: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  challengeRating: string;
  xp: number;
  traits: MonsterFeature[];
  actions: MonsterFeature[];
  damageDefenses?: string | null;
  description: string | null;
  imageUrl?: string | null;
  isNpc: boolean;
}

export interface RuleSection {
  id: string;
  srdIndex?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
  srdUpdatedAt?: string | null;
  name: string;
  description: string | null;
}

// Converte um valor de Nível de Desafio (ex: "1/4", "2") para número, para ordenação.
export function challengeRatingToNumber(cr: string): number {
  if (cr.includes("/")) {
    const [num, den] = cr.split("/").map(Number);
    return num / den;
  }
  return Number(cr);
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  race: string;
  class: string;
  subclass: string | null;
  background: string | null;
  alignment: string | null;
  deity: string | null;
  appearance: string | null;
  backstory: string | null;
  portraitUrl: string | null;
  level: number;
  xp: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  armorClass: number;
  initiative: number;
  proficiencyBonus: number;
  speed: number;
  createdAt: string;
  updatedAt: string;
  resistances?: CharacterResistance[];
  inventory?: InventoryItem[];
  spells?: CharacterSpell[];
  spellSlots?: CharacterSpellSlot[];
}

export interface CharacterResistance {
  id: string;
  damageType: string;
  type: "RESISTANCE" | "IMMUNITY" | "VULNERABILITY";
}

export interface Item {
  id: string;
  srdIndex?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
  srdUpdatedAt?: string | null;
  name: string;
  description: string | null;
  weight: number;
  value: number;
  rarity: string;
  category: string;
  slot: string;
  properties: string | null;
  imageUrl?: string | null;
}

export interface InventoryItem {
  id: string;
  characterId: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  item: Item;
}

export interface Spell {
  id: string;
  srdIndex?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
  srdUpdatedAt?: string | null;
  name: string;
  school: string;
  level: number;
  range: string;
  duration: string;
  concentration: boolean;
  description: string | null;
  classes: string | null;
}

export interface SrdEndpointSummary {
  endpoint: string;
  count: number;
}

export interface SrdResourceSummary {
  id: string;
  endpoint: string;
  index: string;
  name: string;
  url: string;
  source: string;
  srdUpdatedAt: string | null;
  importedAt: string;
}

export interface SrdResourcePage {
  items: SrdResourceSummary[];
  nextCursor: string | null;
}

export interface SrdSyncEndpointResult {
  endpoint: string;
  total: number;
  imported: number;
}

export interface SrdSyncResult {
  source: string;
  endpoints: SrdSyncEndpointResult[];
  imported: number;
}

export interface CharacterSpell {
  id: string;
  characterId: string;
  spellId: string;
  prepared: boolean;
  spell: Spell;
}

export interface CharacterSpellSlot {
  id: string;
  characterId: string;
  level: number;
  total: number;
  used: number;
}

export interface DiceRollBreakdown {
  diceCount: number;
  diceSides: number;
  rolls: number[];
  modifier: number;
  total: number;
}

export type DiceVisibility = "PUBLIC" | "MASTER" | "PRIVATE";

export interface DiceRoll {
  id: string;
  userId: string;
  characterId: string | null;
  campaignId: string | null;
  visibility: DiceVisibility;
  formula: string;
  result: number;
  breakdown: DiceRollBreakdown;
  createdAt: string;
  character?: { id: string; name: string } | null;
  user?: { id: string; displayName: string };
}

export const ATTRIBUTE_LABELS: Record<string, string> = {
  strength: "Força",
  dexterity: "Destreza",
  constitution: "Constituição",
  intelligence: "Inteligência",
  wisdom: "Sabedoria",
  charisma: "Carisma",
};

export const RACES = [
  "Humano",
  "Elfo",
  "Anão",
  "Halfling",
  "Meio-Orc",
  "Tiefling",
  "Draconato",
  "Gnomo",
];

export const CLASSES = [
  "Guerreiro",
  "Mago",
  "Ladino",
  "Clerigo",
  "Barbaro",
  "Bardo",
  "Druida",
  "Monge",
  "Paladino",
  "Patrulheiro",
  "Feiticeiro",
  "Bruxo",
];

export const ALIGNMENTS = [
  "Leal e Bom",
  "Neutro e Bom",
  "Caótico e Bom",
  "Leal e Neutro",
  "Neutro",
  "Caótico e Neutro",
  "Leal e Mau",
  "Neutro e Mau",
  "Caótico e Mau",
];

// Antecedentes (backgrounds) do System Reference Document de D&D 5e.
export const BACKGROUNDS = [
  "Acólito",
  "Artesão de Guilda",
  "Charlatão",
  "Criminoso",
  "Eremita",
  "Forasteiro",
  "Herói do Povo",
  "Marinheiro",
  "Nobre",
  "Sábio",
  "Soldado",
  "Artista",
  "Órfão de Rua",
];

// Subclasses (arquétipos) do SRD de D&D 5e, organizadas por classe.
export const SUBCLASSES: Record<string, string[]> = {
  Guerreiro: ["Campeão", "Mestre de Batalha", "Cavaleiro Místico"],
  Mago: [
    "Escola de Abjuração",
    "Escola de Adivinhação",
    "Escola de Conjuração",
    "Escola de Encantamento",
    "Escola de Evocação",
    "Escola de Ilusão",
    "Escola de Necromancia",
    "Escola de Transmutação",
  ],
  Ladino: ["Ladrão", "Assassino", "Trapaceiro Arcano"],
  Clerigo: [
    "Domínio da Vida",
    "Domínio da Luz",
    "Domínio da Guerra",
    "Domínio do Conhecimento",
    "Domínio da Natureza",
    "Domínio da Trapaça",
    "Domínio da Tempestade",
  ],
  Barbaro: ["Caminho do Berserker", "Caminho do Totem Guerreiro"],
  Bardo: ["Colégio do Conhecimento", "Colégio do Valor"],
  Druida: ["Círculo da Terra", "Círculo da Lua"],
  Monge: [
    "Caminho da Mão Aberta",
    "Caminho da Sombra",
    "Caminho dos Quatro Elementos",
  ],
  Paladino: [
    "Juramento de Devoção",
    "Juramento dos Antigos",
    "Juramento da Vingança",
  ],
  Patrulheiro: ["Caçador", "Mestre das Feras"],
  Feiticeiro: ["Linhagem Dracônica", "Magia Selvagem"],
  Bruxo: ["O Arquifada", "O Imundo", "O Grande Antigo"],
};

// Panteão de Eldoria — divindades originais inspiradas nos arquétipos clássicos de D&D.
export const DEITIES = [
  "Aurelion, o Sol Eterno (luz, honra, verdade)",
  "Velnara, Senhora das Marés (mar, sorte, viagens)",
  "Tharos, o Forjador (forja, artesanato, coragem)",
  "Mirelle, Tecelã das Estrelas (magia, conhecimento, mistério)",
  "Korrath, o Caçador Sombrio (caça, natureza selvagem, vingança)",
  "Sylvana, Mãe Verde (natureza, fertilidade, cura)",
  "Drakmoor, o Devorador (morte, decadência, medo)",
  "Pellor, o Justo (justiça, leis, proteção)",
  "Nyx, a Véu da Noite (sombras, segredos, sorte)",
  "Brannok, o Inquebrável (guerra, força, lealdade)",
  "Nenhuma",
];
