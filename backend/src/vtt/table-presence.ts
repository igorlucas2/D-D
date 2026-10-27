// Presença na mesa (IM-05): quem está com a mesa aberta, por campanha. Um
// usuário pode ter várias abas; ele só fica "ausente" quando todas estão
// ausentes e sai da lista quando a última fecha. Estado em memória: vale para
// uma instância do servidor (com várias, mover para o adapter do Socket.IO).

export type PresenceStatus = 'online' | 'away';

export interface PresenceMember {
  userId: string;
  displayName: string;
  role: 'master' | 'player';
  status: PresenceStatus;
}

interface Entry {
  displayName: string;
  role: 'master' | 'player';
  sockets: Map<string, PresenceStatus>;
}

export class TablePresence {
  private readonly campaigns = new Map<string, Map<string, Entry>>();

  join(
    campaignId: string,
    socketId: string,
    member: Omit<PresenceMember, 'status'>,
  ) {
    let users = this.campaigns.get(campaignId);
    if (!users) {
      users = new Map();
      this.campaigns.set(campaignId, users);
    }
    const entry = users.get(member.userId) ?? {
      displayName: member.displayName,
      role: member.role,
      sockets: new Map<string, PresenceStatus>(),
    };
    entry.sockets.set(socketId, 'online');
    users.set(member.userId, entry);
  }

  /** Retorna `true` se a lista visível mudou. */
  setStatus(
    campaignId: string,
    userId: string,
    socketId: string,
    status: PresenceStatus,
  ) {
    const entry = this.campaigns.get(campaignId)?.get(userId);
    if (!entry?.sockets.has(socketId)) return false;
    const before = this.statusOf(entry);
    entry.sockets.set(socketId, status);
    return before !== this.statusOf(entry);
  }

  /** Remove uma aba; retorna as campanhas cuja lista mudou. */
  leaveSocket(socketId: string, campaignId?: string): string[] {
    const changed: string[] = [];
    for (const [id, users] of this.campaigns) {
      if (campaignId && id !== campaignId) continue;
      for (const [userId, entry] of users) {
        if (!entry.sockets.delete(socketId)) continue;
        if (entry.sockets.size === 0) users.delete(userId);
        changed.push(id);
      }
      if (users.size === 0) this.campaigns.delete(id);
    }
    return changed;
  }

  removeUser(campaignId: string, userId: string) {
    const users = this.campaigns.get(campaignId);
    const removed = users?.delete(userId) ?? false;
    if (users?.size === 0) this.campaigns.delete(campaignId);
    return removed;
  }

  removeCampaign(campaignId: string) {
    this.campaigns.delete(campaignId);
  }

  list(campaignId: string): PresenceMember[] {
    const users = this.campaigns.get(campaignId);
    if (!users) return [];
    return [...users.entries()]
      .map(([userId, entry]) => ({
        userId,
        displayName: entry.displayName,
        role: entry.role,
        status: this.statusOf(entry),
      }))
      .sort(
        (a, b) =>
          (a.role === 'master' ? -1 : 0) - (b.role === 'master' ? -1 : 0) ||
          a.displayName.localeCompare(b.displayName),
      );
  }

  private statusOf(entry: Entry): PresenceStatus {
    return [...entry.sockets.values()].includes('online') ? 'online' : 'away';
  }
}
