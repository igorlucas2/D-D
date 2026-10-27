import {
  Controller,
  Get,
  Header,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Desligado por padrão (`METRICS_ENABLED=1` liga). Com `METRICS_TOKEN`,
   * exige `Authorization: Bearer <token>`.
   */
  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Headers('authorization') authorization?: string) {
    if (this.config.get<string>('METRICS_ENABLED') !== '1') {
      throw new NotFoundException();
    }

    const token = this.config.get<string>('METRICS_TOKEN');
    if (token && !matchesToken(authorization, token)) {
      throw new UnauthorizedException('Token de métricas inválido.');
    }

    return this.metrics.render();
  }
}

function matchesToken(
  authorization: string | undefined,
  expected: string,
): boolean {
  if (!authorization?.startsWith('Bearer ')) return false;

  const provided = Buffer.from(authorization.slice(7));
  const target = Buffer.from(expected);
  if (provided.length !== target.length) return false;

  return timingSafeEqual(provided, target);
}
