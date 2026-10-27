import 'reflect-metadata';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MetricsController } from './metrics.controller';
import type { MetricsService } from './metrics.service';

const metrics = {
  render: jest.fn().mockResolvedValue('eldoria_outbox_pending 0\n'),
} as unknown as MetricsService;

function config(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('MetricsController', () => {
  it('oculta o endpoint quando desligado', async () => {
    const controller = new MetricsController(config({}), metrics);

    await expect(controller.scrape()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exige bearer token quando configurado', async () => {
    const controller = new MetricsController(
      config({ METRICS_ENABLED: '1', METRICS_TOKEN: 'abc' }),
      metrics,
    );

    await expect(controller.scrape()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.scrape('Bearer abc')).resolves.toContain(
      'eldoria_outbox_pending',
    );
  });

  it('serve sem token quando nenhum foi configurado', async () => {
    const controller = new MetricsController(
      config({ METRICS_ENABLED: '1' }),
      metrics,
    );

    await expect(controller.scrape()).resolves.toContain(
      'eldoria_outbox_pending',
    );
  });
});
