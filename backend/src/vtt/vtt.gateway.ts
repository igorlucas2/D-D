import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/jwt.strategy';
import { gatewayAllowRequest, gatewayCors } from '../config/cors';
import { PrismaService } from '../prisma/prisma.service';
import { expiryToMillis, isSessionExpired } from '../realtime/session';
import { takeToken, type BucketState } from '../realtime/token-bucket';
import {
  TablePresence,
  type PresenceMember,
  type PresenceStatus,
} from './table-presence';
import { projectPlayerMap } from './vtt.projection';
import type { SerializedVttMap } from './vtt.types';

/** Rolagem já autorizada e serializada pelo DiceService. */
export interface TableRollPayload {
  id: string;
  userId: string;
  campaignId: string | null;
  visibility: 'PUBLIC' | 'MASTER' | 'PRIVATE';
}

interface PointPayload {
  campaignId: string;
  mapId: string;
  x: number;
  y: number;
}

/** Ping de um participante, ou "Olhem aqui" do mestre (`focus`). */
export interface TablePingPayload {
  userId: string;
  displayName: string;
  mapId: string;
  x: number;
  y: number;
  focus: boolean;
}

export interface TableNarrationPayload {
  id: string;
  title: string | null;
  content: string;
  from: string;
  /** true quando enviada só a alguns jogadores. */
  restricted: boolean;
  journalEntryId: string | null;
  sentAt: string;
}

export interface NarrationSuggestionPayload {
  characterName: string;
  mapName: string;
  drafts: { id: string; title: string }[];
}

interface ClientToServerEvents {
  'vtt:join': (payload: JoinCampaignPayload) => void;
  'vtt:leave': (payload: JoinCampaignPayload) => void;
  'table:presence:status': (payload: {
    campaignId: string;
    status: PresenceStatus;
  }) => void;
  'table:ping': (payload: PointPayload) => void;
  'table:focus': (payload: PointPayload) => void;
}

interface ServerToClientEvents {
  'story:updated': (payload: { campaignId: string; eventId: string }) => void;
  'table:state': (payload: { campaignId: string }) => void;
  'vtt:joined': (payload: { campaignId: string }) => void;
  'vtt:map:created': (map: SerializedVttMap) => void;
  'vtt:map:updated': (map: SerializedVttMap) => void;
  'vtt:map:removed': (payload: { mapId: string }) => void;
  'table:roll': (roll: TableRollPayload) => void;
  'table:presence': (payload: {
    campaignId: string;
    members: PresenceMember[];
  }) => void;
  'table:ping': (payload: TablePingPayload) => void;
  'table:narration': (payload: TableNarrationPayload) => void;
  'table:combat': (payload: { encounter: unknown; event: unknown }) => void;
  'table:chat': (message: unknown) => void;
  'table:narration:suggestion': (payload: NarrationSuggestionPayload) => void;
  'vtt:error': (payload: { message: string }) => void;
}

interface InterServerEvents {
  'vtt:noop': () => void;
}

interface SocketData {
  userId: string;
  email: string;
  lastPointAt: number;
  /** Expiração do JWT em milissegundos (0 = sem prazo). */
  expiresAt: number;
  buckets?: Record<string, BucketState>;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

const POINT_INTERVAL_MS = 1000;

interface JoinCampaignPayload {
  campaignId: string;
  /** false: conexão auxiliar (ex.: painel de combate) que não conta presença. */
  presence?: boolean;
}

type VttSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  Partial<SocketData>
>;

@WebSocketGateway({
  namespace: 'vtt',
  cors: gatewayCors,
  allowRequest: gatewayAllowRequest,
})
export class VttGateway
  implements
    OnGatewayConnection<VttSocket>,
    OnGatewayDisconnect<VttSocket>,
    OnGatewayInit,
    OnModuleDestroy
{
  private readonly presence = new TablePresence();
  private readonly logger = new Logger(VttGateway.name);
  private sweepTimer?: ReturnType<typeof setInterval>;

  @WebSocketServer()
  private server!: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    Partial<SocketData>
  >;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: VttSocket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload & { exp?: number }>(
        token,
      );
      const expiresAt = expiryToMillis(payload.exp);
      if (isSessionExpired(expiresAt)) {
        client.disconnect(true);
        return;
      }
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.expiresAt = expiresAt;
      this.scheduleExpiry(client, expiresAt);
    } catch {
      client.disconnect(true);
    }
  }

  afterInit() {
    // Rede de segurança: o timer de cada socket cobre o caso normal; a varredura
    // encerra conexões cujo timer se perdeu (relógio, suspensão do processo).
    this.sweepTimer = setInterval(() => {
      void this.sweepExpiredSessions();
    }, 60_000);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  handleDisconnect(client: VttSocket) {
    if (client.data.expiryTimer) clearTimeout(client.data.expiryTimer);
    for (const campaignId of this.presence.leaveSocket(client.id)) {
      this.emitPresence(campaignId);
    }
  }

  /** Encerra o socket exatamente quando o JWT vence. */
  private scheduleExpiry(client: VttSocket, expiresAt: number) {
    const remaining = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => client.disconnect(true), remaining);
    timer.unref?.();
    client.data.expiryTimer = timer;
  }

  private async sweepExpiredSessions() {
    if (!this.server) return;

    const sockets = await this.server.fetchSockets();
    const now = Date.now();
    let closed = 0;

    for (const socket of sockets) {
      if (isSessionExpired(socket.data.expiresAt, now)) {
        socket.disconnect(true);
        closed += 1;
      }
    }

    if (closed > 0) {
      this.logger.log(
        `${closed} conexão(ões) encerrada(s) por sessão expirada.`,
      );
    }
  }

  /** Confere a expiração em cada evento: o handshake sozinho não basta. */
  private ensureActiveSession(client: VttSocket): boolean {
    if (!client.data.userId || isSessionExpired(client.data.expiresAt)) {
      client.emit('vtt:error', {
        message: 'Sessão expirada. Entre novamente.',
      });
      client.disconnect(true);
      return false;
    }
    return true;
  }

  /** Token bucket por evento: evita rajada de join/presença em um socket. */
  private allowEvent(
    client: VttSocket,
    key: string,
    capacity: number,
    refillIntervalMs: number,
  ): boolean {
    const buckets = client.data.buckets ?? {};
    const result = takeToken(buckets[key], capacity, refillIntervalMs);
    if (!result.allowed) return false;
    client.data.buckets = { ...buckets, [key]: result.state };
    return true;
  }

  @SubscribeMessage('vtt:join')
  async joinCampaign(
    @ConnectedSocket() client: VttSocket,
    @MessageBody() payload: JoinCampaignPayload,
  ) {
    if (!this.ensureActiveSession(client)) return;
    // Rajada de join/leave dispara consulta de papel e broadcast de presença.
    if (!this.allowEvent(client, 'room', 10, 2_000)) return;

    const campaignId = this.getCampaignId(payload);
    const userId = client.data.userId;

    if (!campaignId || !userId) {
      client.emit('vtt:error', { message: 'Conexao da mesa invalida.' });
      return;
    }

    const role = await this.getCampaignRole(campaignId, userId);
    if (!role) {
      client.emit('vtt:error', {
        message: 'Voce nao tem acesso a esta campanha.',
      });
      return;
    }

    // Mestre e jogadores ficam em salas separadas: cada uma recebe apenas a
    // projecao autorizada do mapa (MV-01).
    await client.join([
      role === 'master'
        ? this.masterRoom(campaignId)
        : this.playersRoom(campaignId),
      // Rolagens privadas chegam só às abas do próprio usuário.
      this.userRoom(campaignId, userId),
    ]);
    client.emit('vtt:joined', { campaignId });

    if (payload?.presence === false) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    this.presence.join(campaignId, client.id, {
      userId,
      displayName: user?.displayName ?? 'Participante',
      role,
    });
    this.emitPresence(campaignId);
  }

  @SubscribeMessage('table:presence:status')
  setPresenceStatus(
    @ConnectedSocket() client: VttSocket,
    @MessageBody() payload: { campaignId?: unknown; status?: unknown },
  ) {
    if (!this.ensureActiveSession(client)) return;
    if (!this.allowEvent(client, 'presence', 5, 2_000)) return;

    const campaignId = this.getCampaignId(payload);
    const status = payload?.status;
    const userId = client.data.userId;
    if (!campaignId || !userId || (status !== 'online' && status !== 'away'))
      return;
    if (this.presence.setStatus(campaignId, userId, client.id, status)) {
      this.emitPresence(campaignId);
    }
  }

  @SubscribeMessage('table:ping')
  async ping(
    @ConnectedSocket() client: VttSocket,
    @MessageBody() payload: unknown,
  ) {
    await this.point(client, payload, false);
  }

  @SubscribeMessage('table:focus')
  async focus(
    @ConnectedSocket() client: VttSocket,
    @MessageBody() payload: unknown,
  ) {
    await this.point(client, payload, true);
  }

  @SubscribeMessage('vtt:leave')
  async leaveCampaign(
    @ConnectedSocket() client: VttSocket,
    @MessageBody() payload: JoinCampaignPayload,
  ) {
    if (!this.ensureActiveSession(client)) return;
    if (!this.allowEvent(client, 'room', 10, 2_000)) return;

    const campaignId = this.getCampaignId(payload);
    if (!campaignId) return;
    if (this.presence.leaveSocket(client.id, campaignId).length) {
      this.emitPresence(campaignId);
    }
    await client.leave(this.masterRoom(campaignId));
    await client.leave(this.playersRoom(campaignId));
    if (client.data.userId) {
      await client.leave(this.userRoom(campaignId, client.data.userId));
    }
  }

  /** `map` e a serializacao completa; jogadores recebem so a projecao. */
  async emitMapCreated(campaignId: string, map: SerializedVttMap) {
    await this.broadcastMap(campaignId, map, 'vtt:map:created');
  }

  async emitMapUpdated(campaignId: string, map: SerializedVttMap) {
    await this.broadcastMap(campaignId, map, 'vtt:map:updated');
  }

  emitMapRemoved(campaignId: string, mapId: string) {
    this.server
      .to([this.masterRoom(campaignId), this.playersRoom(campaignId)])
      .emit('vtt:map:removed', { mapId });
  }

  /**
   * Publicar ou ocultar um mapa muda a projecao dos demais (hotspots e
   * hierarquia apontam para ele), entao os jogadores recebem tudo de novo.
   */
  resyncPlayers(
    campaignId: string,
    masterId: string,
    maps: SerializedVttMap[],
  ) {
    const room = this.playersRoom(campaignId);
    const publishedIds = new Set(
      maps.filter((map) => map.published).map((map) => map.id),
    );
    for (const map of maps) {
      if (map.published) {
        this.server
          .to(room)
          .emit(
            'vtt:map:updated',
            projectPlayerMap(map, publishedIds, masterId),
          );
      } else {
        this.server.to(room).emit('vtt:map:removed', { mapId: map.id });
      }
    }
  }

  /**
   * PUBLIC: toda a mesa. MASTER: mestre e quem rolou. PRIVATE: só quem rolou.
   * O destinatário é decidido aqui, nunca pelo cliente.
   */
  emitRoll(campaignId: string, roll: TableRollPayload) {
    const rooms =
      roll.visibility === 'PUBLIC'
        ? [this.masterRoom(campaignId), this.playersRoom(campaignId)]
        : roll.visibility === 'MASTER'
          ? [
              this.masterRoom(campaignId),
              this.userRoom(campaignId, roll.userId),
            ]
          : [this.userRoom(campaignId, roll.userId)];
    this.server.to(rooms).emit('table:roll', roll);
  }

  /**
   * Narração (IM-06): `recipientIds` null = toda a mesa; caso contrário, só
   * as abas desses jogadores e o mestre.
   */
  emitNarration(
    campaignId: string,
    narration: TableNarrationPayload,
    recipientIds: string[] | null,
  ) {
    const rooms = recipientIds
      ? [
          this.masterRoom(campaignId),
          ...recipientIds.map((id) => this.userRoom(campaignId, id)),
        ]
      : [this.masterRoom(campaignId), this.playersRoom(campaignId)];
    this.server.to(rooms).emit('table:narration', narration);
  }

  emitToMaster(
    campaignId: string,
    event: 'table:narration:suggestion',
    payload: NarrationSuggestionPayload,
  ) {
    this.server.to(this.masterRoom(campaignId)).emit(event, payload);
  }

  /** Entrega a uma pessoa (todas as abas dela nesta campanha). */
  emitToUser(
    campaignId: string,
    userId: string,
    event: 'table:chat',
    payload: unknown,
  ) {
    this.server.to(this.userRoom(campaignId, userId)).emit(event, payload);
  }

  /** An invalidation only: private text and revision counters never enter the room payload. */
  async emitStoryUpdateToUser(
    campaignId: string,
    userId: string,
    eventId: string,
  ) {
    if (!this.server) throw new Error('Realtime transport unavailable');
    const sockets = await this.server
      .in(this.userRoom(campaignId, userId))
      .fetchSockets();
    for (const socket of sockets) {
      if (socket.data.userId !== userId) continue;
      if (isSessionExpired(socket.data.expiresAt)) {
        socket.disconnect(true);
        continue;
      }
      socket.emit('story:updated', { campaignId, eventId });
    }
  }

  /** Invalidação para telas de estado (copiloto, intenções, comandos, prazos). */
  emitCampaignUpdated(campaignId: string) {
    this.server
      .to([this.masterRoom(campaignId), this.playersRoom(campaignId)])
      .emit('table:state', { campaignId });
  }

  /** Combate (MV-09): cada papel recebe a sua projeção já pronta. */
  emitCombat(
    campaignId: string,
    master: { encounter: unknown; event: unknown },
    players: { encounter: unknown; event: unknown },
  ) {
    this.server.to(this.masterRoom(campaignId)).emit('table:combat', master);
    this.server.to(this.playersRoom(campaignId)).emit('table:combat', players);
  }

  /** Remove da mesa quem saiu ou foi removido da campanha. */
  async evictUser(campaignId: string, userId: string) {
    const rooms = [
      this.masterRoom(campaignId),
      this.playersRoom(campaignId),
      this.userRoom(campaignId, userId),
    ];
    const sockets = await this.server.in(rooms).fetchSockets();
    for (const socket of sockets) {
      if (socket.data.userId !== userId) continue;
      for (const room of rooms) socket.leave(room);
      socket.emit('vtt:error', {
        message: 'Voce nao faz mais parte desta campanha.',
      });
    }
    if (this.presence.removeUser(campaignId, userId)) {
      this.emitPresence(campaignId);
    }
  }

  async closeCampaign(campaignId: string) {
    this.presence.removeCampaign(campaignId);
    const prefix = `campaign:${campaignId}:`;
    const sockets = await this.server
      .in([this.masterRoom(campaignId), this.playersRoom(campaignId)])
      .fetchSockets();
    for (const socket of sockets) {
      for (const room of socket.rooms) {
        if (room.startsWith(prefix)) socket.leave(room);
      }
    }
  }

  private emitPresence(campaignId: string) {
    this.server
      .to([this.masterRoom(campaignId), this.playersRoom(campaignId)])
      .emit('table:presence', {
        campaignId,
        members: this.presence.list(campaignId),
      });
  }

  /**
   * Ping (qualquer participante) ou foco (só mestre). Validado no servidor:
   * participação atual, limite de frequência, célula dentro do mapa e, para
   * jogadores, apenas mapas publicados. Ping em mapa em preparação fica entre
   * mestre e mestre.
   */
  private async point(client: VttSocket, payload: unknown, focus: boolean) {
    if (!this.ensureActiveSession(client)) return;
    const userId = client.data.userId;
    const point = this.parsePoint(payload);
    if (!userId || !point) return;

    const now = Date.now();
    if (now - (client.data.lastPointAt ?? 0) < POINT_INTERVAL_MS) return;
    client.data.lastPointAt = now;

    const role = await this.getCampaignRole(point.campaignId, userId);
    if (!role || (focus && role !== 'master')) return;

    const map = await this.prisma.vttMap.findUnique({
      where: { id: point.mapId },
      select: { campaignId: true, published: true, width: true, height: true },
    });
    if (!map || map.campaignId !== point.campaignId) return;
    if (point.x >= map.width || point.y >= map.height) return;
    if (!map.published && (role !== 'master' || focus)) return;

    const member = this.presence
      .list(point.campaignId)
      .find((item) => item.userId === userId);
    const rooms = map.published
      ? [this.masterRoom(point.campaignId), this.playersRoom(point.campaignId)]
      : [this.masterRoom(point.campaignId)];
    this.server.to(rooms).emit('table:ping', {
      userId,
      displayName: member?.displayName ?? 'Participante',
      mapId: point.mapId,
      x: point.x,
      y: point.y,
      focus,
    });
  }

  private parsePoint(payload: unknown): PointPayload | null {
    if (!payload || typeof payload !== 'object') return null;
    const { campaignId, mapId, x, y } = payload as Record<string, unknown>;
    if (typeof campaignId !== 'string' || typeof mapId !== 'string')
      return null;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    if ((x as number) < 0 || (y as number) < 0) return null;
    return { campaignId, mapId, x: x as number, y: y as number };
  }

  private async broadcastMap(
    campaignId: string,
    map: SerializedVttMap,
    event: 'vtt:map:created' | 'vtt:map:updated',
  ) {
    this.server.to(this.masterRoom(campaignId)).emit(event, map);
    // Mapa em preparacao nao gera evento para jogadores, nem de remocao: a
    // atividade do mestre nao vaza. Despublicar e tratado por resyncPlayers.
    if (!map.published) return;
    const playersRoom = this.playersRoom(campaignId);
    const [campaign, published] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { masterId: true },
      }),
      this.prisma.vttMap.findMany({
        where: { campaignId, published: true },
        select: { id: true },
      }),
    ]);
    if (!campaign) return;
    const publishedIds = new Set(published.map((item) => item.id));
    this.server
      .to(playersRoom)
      .emit(event, projectPlayerMap(map, publishedIds, campaign.masterId));
  }

  private extractToken(client: VttSocket) {
    const auth = client.handshake.auth as Record<string, unknown>;
    const token = auth.token;
    return typeof token === 'string' ? token : null;
  }

  private getCampaignId(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;
    const campaignId = (payload as Record<string, unknown>).campaignId;
    return typeof campaignId === 'string' && campaignId ? campaignId : null;
  }

  private masterRoom(campaignId: string) {
    return `campaign:${campaignId}:master`;
  }

  private playersRoom(campaignId: string) {
    return `campaign:${campaignId}:players`;
  }

  private userRoom(campaignId: string, userId: string) {
    return `campaign:${campaignId}:user:${userId}`;
  }

  private async getCampaignRole(
    campaignId: string,
    userId: string,
  ): Promise<'master' | 'player' | null> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });

    if (!campaign) return null;
    if (campaign.masterId === userId) return 'master';
    return campaign.members.some((member) => member.userId === userId)
      ? 'player'
      : null;
  }
}
