import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Acima disso o outbox está atrasado o suficiente para a instância não ser
// considerada pronta (o monitor usa /health, que continua tolerante).
const OUTBOX_LAG_LIMIT_SECONDS = 120;

interface OutboxStatus {
  pending: number;
  oldestPendingAgeSeconds: number | null;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Verificação do monitor: 200 só se o processo está de pé e o banco aceita. */
  @Get()
  async check() {
    await this.assertDatabase();
    const outbox = await this.outboxStatus().catch(() => null);

    return {
      status: 'ok',
      database: 'ok',
      outbox,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /** Liveness: não toca no banco. */
  @Get('live')
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /** Readiness: banco respondendo e outbox sem atraso excessivo. */
  @Get('ready')
  async ready() {
    await this.assertDatabase();
    const outbox = await this.outboxStatus();
    const lagging =
      outbox.oldestPendingAgeSeconds !== null &&
      outbox.oldestPendingAgeSeconds > OUTBOX_LAG_LIMIT_SECONDS;

    if (lagging) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        checks: { database: 'ok', outbox: 'lagging' },
        outbox,
      });
    }

    return {
      status: 'ok',
      checks: { database: 'ok', outbox: 'ok' },
      outbox,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  private async assertDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        database: 'error',
      });
    }
  }

  private async outboxStatus(): Promise<OutboxStatus> {
    const [pending, oldest] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      this.prisma.outboxEvent.findFirst({
        where: { status: 'PENDING' },
        orderBy: { availableAt: 'asc' },
        select: { availableAt: true },
      }),
    ]);

    return {
      pending,
      oldestPendingAgeSeconds: oldest
        ? Math.max(
            0,
            Math.round((Date.now() - oldest.availableAt.getTime()) / 1000),
          )
        : null,
    };
  }
}
