import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Métricas no formato Prometheus. Os gauges próprios são atualizados a cada
 * 30 s e no momento do scrape; as métricas de processo vêm do prom-client.
 */
@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  readonly registry = new Registry();

  private readonly outboxPending = new Gauge({
    name: 'eldoria_outbox_pending',
    help: 'Eventos do outbox ainda não entregues',
    registers: [this.registry],
  });

  private readonly outboxOldestAge = new Gauge({
    name: 'eldoria_outbox_oldest_age_seconds',
    help: 'Idade do evento pendente mais antigo do outbox',
    registers: [this.registry],
  });

  private readonly autoTickCampaigns = new Gauge({
    name: 'eldoria_auto_tick_campaigns',
    help: 'Campanhas com relógio automático ligado',
    registers: [this.registry],
  });

  private timer?: ReturnType<typeof setInterval>;
  private refreshing = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry, prefix: 'eldoria_' });
    void this.refresh();
    this.timer = setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      const [pending, oldest, autoTick] = await Promise.all([
        this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
        this.prisma.outboxEvent.findFirst({
          where: { status: 'PENDING' },
          orderBy: { availableAt: 'asc' },
          select: { availableAt: true },
        }),
        this.prisma.campaignCalendar.count({
          where: {
            realMinutesPerTick: { gt: 0 },
            campaign: { lore: { is: null } },
          },
        }),
      ]);

      this.outboxPending.set(pending);
      this.outboxOldestAge.set(
        oldest
          ? Math.max(0, (Date.now() - oldest.availableAt.getTime()) / 1000)
          : 0,
      );
      this.autoTickCampaigns.set(autoTick);
    } catch {
      // Banco indisponível: mantém os últimos valores; /health ready acusa.
    } finally {
      this.refreshing = false;
    }
  }

  async render(): Promise<string> {
    await this.refresh();
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
