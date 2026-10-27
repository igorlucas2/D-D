import 'reflect-metadata';
import { DiceService } from './dice.service';
import type { CampaignAccessService } from '../campaigns/campaign-access.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { VttGateway } from '../vtt/vtt.gateway';

function serviceFor() {
  const prisma = {
    diceRoll: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new DiceService(
    prisma as unknown as PrismaService,
    {} as CampaignAccessService,
    {} as VttGateway,
  );
  return { prisma, service };
}

describe('DiceService.getHistory', () => {
  it('limita o histórico entre 1 e 100', async () => {
    const { prisma, service } = serviceFor();

    await service.getHistory('user-1', 9999);
    expect(prisma.diceRoll.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 100 }),
    );

    await service.getHistory('user-1', 0);
    expect(prisma.diceRoll.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it('usa 50 quando o take não é número', async () => {
    const { prisma, service } = serviceFor();

    await service.getHistory('user-1', Number.NaN);
    expect(prisma.diceRoll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});
