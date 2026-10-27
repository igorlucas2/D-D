"use client";

import { Manager, type Socket } from "socket.io-client";

/**
 * Uma única conexão Socket.IO por aba.
 *
 * Um `Manager` mantém o transporte e multiplexa os namespaces `/vtt` e
 * `/world`; cada componente recebe um canal próprio, que só remove os seus
 * handlers ao fechar. As salas (campanhas) têm contagem de referência: o
 * `join` é emitido uma vez e o `leave` só quando o último interessado sai.
 *
 * A autenticação vem do token do usuário; trocar de conta recria o Manager.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const BASE_URL = API_URL.startsWith("http")
  ? API_URL.replace(/\/api\/?$/, "")
  : undefined;

interface CampaignEntry {
  refs: number;
  presence: boolean;
}

interface RealtimeState {
  token: string;
  manager: Manager;
  vtt: Socket;
  world: Socket;
  vttRefs: number;
  worldRefs: number;
  vttCampaigns: Map<string, CampaignEntry>;
  worldCampaigns: Map<string, number>;
}

let state: RealtimeState | null = null;

export class RealtimeChannel<Listen extends object, Send extends object> {
  private readonly handlers: { event: string; handler: (...args: unknown[]) => void }[] = [];
  private closed = false;

  constructor(
    private readonly socket: Socket,
    private readonly release: () => void,
  ) {}

  on<E extends keyof Listen & string>(
    event: E,
    handler: Listen[E] extends (...args: never[]) => unknown ? Listen[E] : never,
  ): void {
    if (this.closed) return;
    const wrapped = handler as unknown as (...args: unknown[]) => void;
    (this.socket.on as (name: string, listener: (...args: unknown[]) => void) => void)(event, wrapped);
    this.handlers.push({ event, handler: wrapped });
  }

  emit<E extends keyof Send & string>(
    event: E,
    ...args: Send[E] extends (...args: infer A) => unknown ? A : never
  ): void {
    if (this.closed) return;
    (this.socket.emit as (name: string, ...params: unknown[]) => void)(event, ...args);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const { event, handler } of this.handlers) {
      (this.socket.off as (name: string, listener: (...args: unknown[]) => void) => void)(event, handler);
    }
    this.handlers.length = 0;
    this.release();
  }
}

export class CampaignChannel<
  Listen extends object,
  Send extends object,
> extends RealtimeChannel<Listen, Send> {
  private readonly joined = new Set<string>();

  constructor(
    socket: Socket,
    release: () => void,
    private readonly joinRoom: (campaignId: string, presence: boolean) => void,
    private readonly leaveRoom: (campaignId: string) => void,
  ) {
    super(socket, release);
  }

  join(campaignId: string, presence = false): void {
    if (this.joined.has(campaignId)) return;
    this.joined.add(campaignId);
    this.joinRoom(campaignId, presence);
  }

  leave(campaignId: string): void {
    if (!this.joined.delete(campaignId)) return;
    this.leaveRoom(campaignId);
  }

  override close(): void {
    for (const campaignId of this.joined) this.leaveRoom(campaignId);
    this.joined.clear();
    super.close();
  }
}

function createClient(token: string): RealtimeState {
  const manager = new Manager(BASE_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionDelayMax: 5_000,
    transports: ["websocket", "polling"],
  });
  const vtt = manager.socket("/vtt", { auth: { token } });
  const world = manager.socket("/world", { auth: { token } });

  const client: RealtimeState = {
    token,
    manager,
    vtt,
    world,
    vttRefs: 0,
    worldRefs: 0,
    vttCampaigns: new Map(),
    worldCampaigns: new Map(),
  };

  vtt.on("connect", () => {
    for (const [campaignId, entry] of client.vttCampaigns) {
      vtt.emit("vtt:join", { campaignId, presence: entry.presence });
    }
  });
  world.on("connect", () => {
    for (const campaignId of client.worldCampaigns.keys()) {
      world.emit("world:join", { campaignId });
    }
  });

  return client;
}

function ensureClient(token: string): RealtimeState {
  if (state && state.token !== token) {
    state.vtt.disconnect();
    state.world.disconnect();
    state = null;
  }
  if (!state) state = createClient(token);
  return state;
}

function disposeIfIdle(client: RealtimeState): void {
  if (client.vttRefs > 0 || client.worldRefs > 0) return;
  client.vtt.disconnect();
  client.world.disconnect();
  if (state === client) state = null;
}

function joinVtt(
  client: RealtimeState,
  campaignId: string,
  presence: boolean,
): void {
  const entry = client.vttCampaigns.get(campaignId) ?? {
    refs: 0,
    presence: false,
  };
  entry.refs += 1;
  const upgraded = presence && !entry.presence;
  entry.presence = entry.presence || presence;
  client.vttCampaigns.set(campaignId, entry);

  if ((entry.refs === 1 || upgraded) && client.vtt.connected) {
    client.vtt.emit("vtt:join", { campaignId, presence: entry.presence });
  }
}

function leaveVtt(client: RealtimeState, campaignId: string): void {
  const entry = client.vttCampaigns.get(campaignId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  client.vttCampaigns.delete(campaignId);
  if (client.vtt.connected) client.vtt.emit("vtt:leave", { campaignId });
}

function joinWorld(client: RealtimeState, campaignId: string): void {
  const refs = (client.worldCampaigns.get(campaignId) ?? 0) + 1;
  client.worldCampaigns.set(campaignId, refs);
  if (refs === 1 && client.world.connected) {
    client.world.emit("world:join", { campaignId });
  }
}

function leaveWorld(client: RealtimeState, campaignId: string): void {
  const refs = client.worldCampaigns.get(campaignId);
  if (!refs) return;
  if (refs > 1) {
    client.worldCampaigns.set(campaignId, refs - 1);
    return;
  }
  client.worldCampaigns.delete(campaignId);
  if (client.world.connected) client.world.emit("world:leave", { campaignId });
}

export function acquireVtt<Listen extends object, Send extends object>(
  token: string,
): CampaignChannel<Listen, Send> {
  const client = ensureClient(token);
  client.vttRefs += 1;
  if (client.vttRefs === 1) client.vtt.connect();

  return new CampaignChannel<Listen, Send>(
    client.vtt,
    () => {
      client.vttRefs -= 1;
      disposeIfIdle(client);
    },
    (campaignId, presence) => joinVtt(client, campaignId, presence),
    (campaignId) => leaveVtt(client, campaignId),
  );
}

export function acquireWorld<Listen extends object, Send extends object>(
  token: string,
): CampaignChannel<Listen, Send> {
  const client = ensureClient(token);
  client.worldRefs += 1;
  if (client.worldRefs === 1) client.world.connect();

  return new CampaignChannel<Listen, Send>(
    client.world,
    () => {
      client.worldRefs -= 1;
      disposeIfIdle(client);
    },
    (campaignId) => joinWorld(client, campaignId),
    (campaignId) => leaveWorld(client, campaignId),
  );
}
