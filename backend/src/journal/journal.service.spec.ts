import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampaignAccessService } from '../campaigns/campaign-access.service';
import type { WorldService } from '../world/world.service';
import { JournalService } from './journal.service';

function setup() {
  const findMany = jest.fn().mockResolvedValue([]);
  const member = jest
    .fn()
    .mockResolvedValue({ id: 'campaign-1', masterId: 'master-1' });
  const prisma = {
    campaignJournalEntry: { findMany },
  } as unknown as PrismaService;
  const access = { member } as unknown as CampaignAccessService;
  const service = new JournalService(prisma, access, {} as WorldService);
  return { service, findMany, member };
}

describe('JournalService.findAll', () => {
  it('limita a página e usa cursor quando informado', async () => {
    const { service, findMany, member } = setup();

    await service.findAll('campaign-1', 'master-1', {
      take: 999,
      cursor: 'entry-30',
    });

    expect(member).toHaveBeenCalledWith('campaign-1', 'master-1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        cursor: { id: 'entry-30' },
        skip: 1,
        orderBy: [
          { sessionDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
  });

  it('aplica a página padrão de 50', async () => {
    const { service, findMany } = setup();

    await service.findAll('campaign-1', 'player-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});
