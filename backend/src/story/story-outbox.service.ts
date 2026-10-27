import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VttGateway } from '../vtt/vtt.gateway';

@Injectable()
export class StoryOutboxService {
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: VttGateway,
  ) {}
  @Interval(2000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.drain();
    } catch {
      /* A temporary database outage leaves durable rows for the next tick. */
    } finally {
      this.running = false;
    }
  }
  async drain() {
    const now = new Date();
    const due = {
      OR: [
        { status: 'PENDING' as const, availableAt: { lte: now } },
        { status: 'PROCESSING' as const, leaseUntil: { lte: now } },
      ],
    };
    const rows = await this.prisma.outboxEvent.findMany({
      where: due,
      orderBy: { availableAt: 'asc' },
      take: 50,
    });
    for (const row of rows) {
      const leaseToken = randomUUID();
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: { id: row.id, ...due },
        data: {
          status: 'PROCESSING',
          leaseToken,
          leaseUntil: new Date(Date.now() + 30000),
          attempts: { increment: 1 },
        },
      });
      if (!claimed.count) continue;
      try {
        // Recheck current membership/audience at delivery, not only when the event was committed.
        await this.prisma.$transaction(
          async (tx) => {
            const event = await tx.storyEvent.findUnique({
              where: { id: row.eventId },
              include: {
                audience: { include: { members: true } },
                lore: { include: { campaign: { include: { members: true } } } },
              },
            });
            if (!event) return;
            const campaign = event.lore.campaign;
            const users = new Set([
              campaign.masterId,
              ...campaign.members.map((m) => m.userId),
            ]);
            for (const userId of users) {
              if (
                userId !== campaign.masterId &&
                event.audience.scope !== 'PUBLIC' &&
                !(
                  event.audience.scope === 'RECIPIENTS' &&
                  event.audience.members.some((m) => m.userId === userId)
                )
              )
                continue;
              await this.gateway.emitStoryUpdateToUser(
                campaign.id,
                userId,
                event.id,
              );
            }
          },
          { isolationLevel: 'Serializable', timeout: 15000 },
        );
        await this.prisma.outboxEvent.updateMany({
          where: { id: row.id, leaseToken, status: 'PROCESSING' },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
            leaseToken: null,
            leaseUntil: null,
            lastError: null,
          },
        });
      } catch {
        await this.prisma.outboxEvent.updateMany({
          where: { id: row.id, leaseToken, status: 'PROCESSING' },
          data: {
            status: 'PENDING',
            availableAt: new Date(
              Date.now() +
                Math.min(300000, 2000 * 2 ** Math.min(row.attempts, 7)),
            ),
            leaseToken: null,
            leaseUntil: null,
            lastError: 'DELIVERY_FAILED',
          },
        });
      }
    }
  }
}
