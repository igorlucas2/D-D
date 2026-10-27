import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { AuditService } from './audit.service';

function setup() {
  const findMany = jest.fn();
  const create = jest.fn();
  const prisma = {
    auditLog: { findMany, create },
  } as unknown as PrismaService;
  const master = jest.fn().mockResolvedValue({ id: 'campaign-1' });
  const access = { master } as unknown as CampaignAccessService;
  const service = new AuditService(prisma, access);
  return { service, master, findMany, create };
}

describe('AuditService', () => {
  it('exige mestre antes de listar e pagina por cursor', async () => {
    const { service, master, findMany } = setup();
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    const page: { items: { id: string }[]; nextCursor: string | null } =
      await service.list('campaign-1', 'master-1', { take: 2 });

    expect(master).toHaveBeenCalledWith('campaign-1', 'master-1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, where: { campaignId: 'campaign-1' } }),
    );
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('b');
  });

  it('limita take e repassa o cursor', async () => {
    const { service, findMany } = setup();
    findMany.mockResolvedValue([]);

    await service.list('campaign-1', 'master-1', {
      take: 999,
      cursor: 'abc',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 101,
        cursor: { id: 'abc' },
        skip: 1,
      }),
    );
  });

  it('grava os campos normalizados, sem corpo bruto', async () => {
    const { service, create } = setup();
    create.mockResolvedValue({ id: 'log-1' });

    await service.record({
      campaignId: 'campaign-1',
      actorId: 'master-1',
      action: 'vtt.map.update',
      resource: 'vtt-map',
      resourceId: 'map-1',
      summary: 'PATCH /api/campaigns/:campaignId/vtt/maps/:mapId',
      requestId: 'req-1',
      metadata: { method: 'PATCH', bodyKeys: ['name'] },
    });

    expect(create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- matcher do Jest
      data: expect.objectContaining({
        campaignId: 'campaign-1',
        actorId: 'master-1',
        action: 'vtt.map.update',
        resourceId: 'map-1',
        requestId: 'req-1',
        metadata: { method: 'PATCH', bodyKeys: ['name'] },
      }),
    });
  });
});
