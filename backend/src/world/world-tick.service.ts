import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorldService } from './world.service';

// Avanca o relogio das campanhas com `realMinutesPerTick > 0` mesmo sem
// jogadores conectados (Fase 5 do Mundo Vivo). O CAS em `lastTickAt` dentro de
// advanceAutoTick garante que duas instancias nao somem o mesmo tick.
@Injectable()
export class WorldTickService {
  private readonly logger = new Logger(WorldTickService.name);

  constructor(private readonly worldService: WorldService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTick() {
    const calendars = await this.worldService.findCampaignsWithAutoTick();

    for (const calendar of calendars) {
      try {
        const advanced = await this.worldService.advanceAutoTick(calendar);
        if (!advanced) continue;

        if (
          calendar.eventChancePercent > 0 &&
          Math.random() * 100 < calendar.eventChancePercent
        ) {
          await this.worldService.rollWorldEvent(calendar.campaignId);
        }
      } catch (error) {
        this.logger.error(
          `Falha ao avançar o relógio da campanha ${calendar.campaignId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
