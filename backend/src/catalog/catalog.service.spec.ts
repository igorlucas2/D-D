import 'reflect-metadata';
import { CatalogService } from './catalog.service';
import type { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    item: { findMany: jest.fn().mockResolvedValue([]) },
    spell: { findMany: jest.fn().mockResolvedValue([]) },
    monster: { findMany: jest.fn().mockResolvedValue([]) },
    ruleSection: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function serviceFor(prisma: ReturnType<typeof prismaMock>) {
  return new CatalogService(prisma as unknown as PrismaService);
}

describe('CatalogService', () => {
  it('limita listas a 500 por padrão e nunca acima disso', async () => {
    const prisma = prismaMock();
    const service = serviceFor(prisma);

    await service.listItems();
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );

    await service.listItems(9999);
    expect(prisma.item.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });

  it('respeita take menor e ordena de forma estável', async () => {
    const prisma = prismaMock();
    await serviceFor(prisma).listRules(25);

    expect(prisma.ruleSection.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 25,
    });
  });
});
