import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorldService } from './world.service';

const MS_PER_MINUTE = 60_000;

// Avanca o relogio das campanhas com `realMinutesPerTick > 0` mesmo sem
// jogadores conectados (Fase 5 do Mundo Vivo).
@Injectable()
export class WorldTickService {
  private readonly logger = new Logger(WorldTickService.name);

  constructor(private readonly worldService: WorldService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTick() {
    const calendars = await this.worldService.findCampaignsWithAutoTick();
    const now = Date.now();

    for (const calendar of calendars) {
      const elapsedMinutes =
        (now - calendar.updatedAt.getTime()) / MS_PER_MINUTE;
      if (elapsedMinutes < calendar.realMinutesPerTick) continue;

      try {
        await this.worldService.addMinutes(
          calendar.campaignId,
          calendar.gameMinutesPerTick,
        );

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
