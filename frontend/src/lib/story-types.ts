export interface StoryFact {
  editable?: boolean;
  id: string;
  key: string;
  kind: "FACT" | "CLAIM";
  classification: string;
  text: string;
  revisionId: string;
  version?: number;
  audience?: string;
  evaluation?: string | null;
  subjects?: { id: string; name: string }[];
}
export interface StoryState {
  installed: boolean;
  initialized: boolean;
  master?: boolean;
  revision?: number;
  entities?: { id: string; key: string; name: string; kind: string }[];
  members?: { id: string; name: string }[];
  characters?: { id: string; name: string }[];
  facts: StoryFact[];
  knowledge: {
    id: string;
    knowerId: string;
    knowerName: string;
    text: string;
    kind: string;
    stance: string;
    source: string;
    stale?: boolean;
    version?: number;
  }[];
  promises: {
    id: string;
    giver: string;
    receiver: string;
    terms: string;
    status: string;
    resolution: string | null;
  }[];
  threads: {
    id: string;
    objective: string;
    status: string;
    resolution: string | null;
    completion?: string;
    consequence?: string;
  }[];
  relationships: {
    id: string;
    from: string;
    to: string;
    description: string;
    trust?: number;
    fear?: number;
  }[];
}
export interface StoryEvent {
  id: string;
  kind: string;
  summary: string;
  recordedAt: string;
  gameMinute: number;
  sequence?: number;
  actorName?: string;
  correctsEventId?: string | null;
  payload?: unknown;
}
export interface StoryEvents {
  events: StoryEvent[];
  nextCursor: string | null;
}
export const storyLabels: Record<string, string> = {
  DOMAIN_INITIALIZED: "Comandos preparados",
  GROUP_TRAVEL: "Viagem do grupo",
  GROUP_REST: "Descanso do grupo",
  OBJECT_TAKEN: "Objeto carregado",
  OBJECT_DROPPED: "Objeto deixado",
  CLOCK_ADVANCED: "Tempo da cena",
  AUTOMATION_CONFIGURED: "Permissões dos prazos",
  CONSEQUENCE_SCHEDULED: "Prazo preparado",
  CONSEQUENCE_CANCELLED: "Prazo cancelado",
  SCHEDULED_NOTICE: "Lembrete do mundo",
  NPC_DEPARTED: "Partida de NPC",
  NPC_ARRIVED: "Chegada de NPC",
  KNOWN: "Sabe",
  BELIEVED: "Acredita",
  SUSPECTED: "Suspeita",
  OPEN: "Em aberto",
  FULFILLED: "Cumprida",
  BROKEN: "Quebrada",
  CANCELLED: "Cancelada",
  RESOLVED: "Resolvido",
  ABANDONED: "Abandonado",
  FACT: "Fato",
  CLAIM: "Rumor",
  MASTER: "Mestre",
  PUBLIC: "Toda a mesa",
  RECIPIENTS: "Destinatários",
  GENESIS: "Origem",
  NOTE: "Acontecimento",
  FACT_CREATE: "Nova informação",
  FACT_UPDATE: "Evolução de fato",
  CORRECTION: "Correção",
  DISCOVER: "Descoberta",
  RELATIONSHIP: "Relação",
  PROMISE_CREATE: "Nova promessa",
  PROMISE_RESOLVE: "Encerramento de promessa",
  THREAD_UPDATE: "Fio narrativo",
};
