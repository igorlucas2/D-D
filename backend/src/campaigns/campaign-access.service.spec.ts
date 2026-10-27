import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  CampaignAccessService,
  type CampaignAccessCampaign,
} from './campaign-access.service';

const baseCampaign = {
  id: 'campaign-1',
  masterId: 'master-1',
  name: 'Mesa',
  members: [
    {
      userId: 'master-1',
      user: { id: 'master-1', displayName: 'Mestre' },
    },
    {
      userId: 'player-1',
      user: { id: 'player-1', displayName: 'Jogadora' },
    },
  ],
} as unknown as CampaignAccessCampaign;

function setup() {
  const findUnique = jest.fn();
  const prisma = { campaign: { findUnique } } as unknown as PrismaService;
  const context = new RequestContextService();
  const access = new CampaignAccessService(prisma, context);
  return { access, context, findUnique };
}

describe('CampaignAccessService', () => {
  it('consulta uma vez por campanha/usuário dentro da mesma requisição', async () => {
    const { access, context, findUnique } = setup();
    findUnique.mockResolvedValue(baseCampaign);

    await context.run(async () => {
      await access.member('campaign-1', 'player-1');
      await access.member('campaign-1', 'player-1');
      await Promise.all([
        access.member('campaign-1', 'player-1'),
        access.member('campaign-1', 'player-1'),
      ]);
    });

    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('não compartilha cache entre requisições nem entre usuários', async () => {
    const { access, context, findUnique } = setup();
    findUnique.mockResolvedValue(baseCampaign);

    await context.run(() => access.member('campaign-1', 'player-1'));
    await context.run(() => access.member('campaign-1', 'player-1'));
    expect(findUnique).toHaveBeenCalledTimes(2);

    await context.run(() => access.member('campaign-1', 'master-1'));
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it('deixa o mestre passar e recusa quem não é membro', async () => {
    const { access, context, findUnique } = setup();
    findUnique.mockResolvedValue(baseCampaign);

    await expect(
      context.run(() => access.master('campaign-1', 'master-1')),
    ).resolves.toMatchObject({ id: 'campaign-1' });
    await expect(
      context.run(() => access.member('campaign-1', 'someone-else')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('respeita as mensagens do chamador e o 404', async () => {
    const { access, context, findUnique } = setup();
    findUnique.mockResolvedValue(baseCampaign);

    await expect(
      context.run(() =>
        access.master('campaign-1', 'player-1', {
          master: 'Apenas o mestre narra.',
        }),
      ),
    ).rejects.toThrow('Apenas o mestre narra.');

    findUnique.mockResolvedValue(null);
    await expect(
      context.run(() => access.member('missing', 'player-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove do cache uma consulta que falhou', async () => {
    const { access, context, findUnique } = setup();
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(baseCampaign);

    await context.run(async () => {
      await expect(
        access.member('campaign-1', 'player-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        access.member('campaign-1', 'player-1'),
      ).resolves.toMatchObject({ id: 'campaign-1' });
    });

    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
