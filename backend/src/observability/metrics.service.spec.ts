import 'reflect-metadata';
import { MetricsService } from './metrics.service';
import type { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    outboxEvent: {
      count: jest.fn().mockResolvedValue(2),
      findFirst: jest
        .fn()
        .mockResolvedValue({ availableAt: new Date(Date.now() - 5_000) }),
    },
    campaignCalendar: { count: jest.fn().mockResolvedValue(1) },
  };
}

describe('MetricsService', () => {
  it('publica gauges do outbox e do relógio automático', async () => {
    const service = new MetricsService(
      prismaMock() as unknown as PrismaService,
    );

    await service.refresh();
    const text = await service.registry.metrics();

    expect(text).toContain('eldoria_outbox_pending 2');
    expect(text).toContain('eldoria_auto_tick_campaigns 1');
    expect(text).toMatch(/eldoria_outbox_oldest_age_seconds [45](?:\.\d+)?/);
  });

  it('mantém os últimos valores quando o banco falha', async () => {
    const prisma = prismaMock();
    const service = new MetricsService(prisma as unknown as PrismaService);

    await service.refresh();
    prisma.outboxEvent.count.mockRejectedValueOnce(new Error('x'));
    await service.refresh();

    const text = await service.registry.metrics();
    expect(text).toContain('eldoria_outbox_pending 2');
  });
});
