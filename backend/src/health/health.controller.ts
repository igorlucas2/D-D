import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Verificação de saúde usada pelo monitor (scripts/eldoria.ps1): responde 200
// só se a aplicação estiver de pé e o banco aceitar consultas.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        database: 'error',
      });
    }
    return {
      status: 'ok',
      database: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
