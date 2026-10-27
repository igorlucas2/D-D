import 'reflect-metadata';
import { SrdService } from './srd.service';
import type { PrismaService } from '../prisma/prisma.service';

function prismaMock(rows: unknown[]) {
  return {
    srdResource: { findMany: jest.fn().mockResolvedValue(rows) },
  };
}

function serviceFor(prisma: ReturnType<typeof prismaMock>) {
  return new SrdService(prisma as unknown as PrismaService);
}

describe('SrdService.listResources', () => {
  it('devolve cursor quando há mais linhas que o take', async () => {
    const prisma = prismaMock([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
    const page = await serviceFor(prisma).listResources(undefined, undefined, {
      take: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('r2');
    expect(prisma.srdResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('não devolve cursor na última página', async () => {
    const prisma = prismaMock([{ id: 'r1' }]);
    const page = await serviceFor(prisma).listResources(undefined, undefined, {
      take: 2,
    });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('limita o take entre 1 e 100', async () => {
    const prisma = prismaMock([]);
    const service = serviceFor(prisma);

    await service.listResources(undefined, undefined, { take: 999 });
    expect(prisma.srdResource.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 101 }),
    );

    await service.listResources(undefined, undefined, { take: 0 });
    expect(prisma.srdResource.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });

  it('aplica filtros e cursor', async () => {
    const prisma = prismaMock([]);
    await serviceFor(prisma).listResources('spells', 'bola', {
      cursor: 'abc',
    });

    expect(prisma.srdResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: 'spells', name: { contains: 'bola' } },
        cursor: { id: 'abc' },
        skip: 1,
      }),
    );
  });
});
