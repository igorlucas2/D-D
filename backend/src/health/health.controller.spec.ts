import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    outboxEvent: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

function controllerFor(prisma: ReturnType<typeof prismaMock>) {
  return new HealthController(prisma as unknown as PrismaService);
}

describe('HealthController', () => {
  it('responde ok quando o banco aceita consultas', async () => {
    await expect(controllerFor(prismaMock()).check()).resolves.toMatchObject({
      status: 'ok',
      database: 'ok',
      outbox: { pending: 0, oldestPendingAgeSeconds: null },
    });
  });

  it('responde 503 quando o banco falha', async () => {
    const prisma = prismaMock({
      $queryRaw: jest.fn().mockRejectedValue(new Error('x')),
    });

    await expect(controllerFor(prisma).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('continua 200 se a consulta do outbox falhar', async () => {
    const prisma = prismaMock({
      outboxEvent: {
        count: jest.fn().mockRejectedValue(new Error('x')),
        findFirst: jest.fn(),
      },
    });

    await expect(controllerFor(prisma).check()).resolves.toMatchObject({
      status: 'ok',
      outbox: null,
    });
  });

  it('liveness não consulta o banco', () => {
    const prisma = prismaMock({
      $queryRaw: jest.fn().mockRejectedValue(new Error('não deveria')),
    });

    expect(controllerFor(prisma).live()).toMatchObject({ status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('readiness fica ok com outbox em dia', async () => {
    await expect(controllerFor(prismaMock()).ready()).resolves.toMatchObject({
      status: 'ok',
      checks: { database: 'ok', outbox: 'ok' },
    });
  });

  it('readiness falha quando o outbox está atrasado', async () => {
    const prisma = prismaMock({
      outboxEvent: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest
          .fn()
          .mockResolvedValue({ availableAt: new Date(Date.now() - 300_000) }),
      },
    });

    await expect(controllerFor(prisma).ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
