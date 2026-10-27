import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import type { SerializedCalendar } from './world.types';

interface ClientToServerEvents {
  'world:join': (payload: JoinCampaignPayload) => void;
  'world:leave': (payload: JoinCampaignPayload) => void;
}

interface ServerToClientEvents {
  'world:joined': (payload: { campaignId: string }) => void;
  'world:clock:updated': (calendar: SerializedCalendar) => void;
  'world:event:triggered': (payload: {
    title: string;
    content: string;
    category: string;
    weather: string | null;
    journalEntryId: string;
  }) => void;
  'world:error': (payload: { message: string }) => void;
}

interface InterServerEvents {
  'world:noop': () => void;
}

interface SocketData {
  userId: string;
  email: string;
}

interface JoinCampaignPayload {
  campaignId: string;
}

type WorldSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  Partial<SocketData>
>;

@WebSocketGateway({
  namespace: 'world',
  cors: { origin: '*' },
})
export class WorldGateway implements OnGatewayConnection<WorldSocket> {
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

  handleConnection(client: WorldSocket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.userId = payload.sub;
      client.data.email = payload.email;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('world:join')
  async joinCampaign(
    @ConnectedSocket() client: WorldSocket,
    @MessageBody() payload: JoinCampaignPayload,
  ) {
    const campaignId = this.getCampaignId(payload);
    const userId = client.data.userId;

    if (!campaignId || !userId) {
      client.emit('world:error', { message: 'Conexao invalida.' });
      return;
    }

    const canJoin = await this.isCampaignMember(campaignId, userId);
    if (!canJoin) {
      client.emit('world:error', {
        message: 'Voce nao tem acesso a esta campanha.',
      });
      return;
    }

    await client.join(this.campaignRoom(campaignId));
    client.emit('world:joined', { campaignId });
  }

  @SubscribeMessage('world:leave')
  async leaveCampaign(
    @ConnectedSocket() client: WorldSocket,
    @MessageBody() payload: JoinCampaignPayload,
  ) {
    const campaignId = this.getCampaignId(payload);
    if (!campaignId) return;
    await client.leave(this.campaignRoom(campaignId));
  }

  /** Remove do relogio quem saiu ou foi removido da campanha. */
  async evictUser(campaignId: string, userId: string) {
    const room = this.campaignRoom(campaignId);
    const sockets = await this.server.in(room).fetchSockets();
    for (const socket of sockets) {
      if (socket.data.userId === userId) socket.leave(room);
    }
  }

  closeCampaign(campaignId: string) {
    this.server
      .in(this.campaignRoom(campaignId))
      .socketsLeave(this.campaignRoom(campaignId));
  }

  /** Evento do mundo sorteado com a mesa aberta (IM-09). */
  emitWorldEvent(
    campaignId: string,
    payload: {
      title: string;
      content: string;
      category: string;
      weather: string | null;
      journalEntryId: string;
    },
  ) {
    this.server
      .to(this.campaignRoom(campaignId))
      .emit('world:event:triggered', payload);
  }

  emitClockUpdated(campaignId: string, calendar: SerializedCalendar) {
    this.server
      .to(this.campaignRoom(campaignId))
      .emit('world:clock:updated', calendar);
  }

  private extractToken(client: WorldSocket) {
    const auth = client.handshake.auth as Record<string, unknown>;
    const token = auth.token;
    return typeof token === 'string' ? token : null;
  }

  private getCampaignId(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;
    const campaignId = (payload as Record<string, unknown>).campaignId;
    return typeof campaignId === 'string' && campaignId ? campaignId : null;
  }

  private campaignRoom(campaignId: string) {
    return `campaign:${campaignId}`;
  }

  private async isCampaignMember(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });

    if (!campaign) return false;

    return (
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId)
    );
  }
}
