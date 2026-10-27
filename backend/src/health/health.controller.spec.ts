import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('responde ok quando o banco aceita consultas', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'ok',
    });
  });

  it('responde 503 quando o banco falha', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('x')) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
