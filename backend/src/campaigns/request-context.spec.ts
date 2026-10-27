import 'reflect-metadata';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { RequestContextService } from '../common/request-context.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CampaignAccessService,
  type CampaignAccessCampaign,
} from './campaign-access.service';

const findUnique = jest.fn();
const prismaMock = { campaign: { findUnique } };

const campaign = {
  id: 'campaign-1',
  masterId: 'master-1',
  name: 'Mesa',
  members: [
    {
      userId: 'player-1',
      user: { id: 'player-1', displayName: 'Jogadora' },
    },
  ],
} as unknown as CampaignAccessCampaign;

@Controller('probe')
class ProbeController {
  constructor(private readonly access: CampaignAccessService) {}

  @Get()
  async check() {
    await this.access.member('campaign-1', 'player-1');
    await this.access.member('campaign-1', 'player-1');
    return { ok: true };
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    RequestContextService,
    CampaignAccessService,
    { provide: PrismaService, useValue: prismaMock },
  ],
})
class ProbeModule {}

describe('cache de autorização por requisição HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    const context = app.get(RequestContextService);
    app.use((_req: Request, _res: Response, next: NextFunction) => {
      context.run(next);
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue(campaign);
  });

  it('duas verificações no mesmo request fazem um SELECT', async () => {
    await request(app.getHttpServer() as Server)
      .get('/probe')
      .expect(200);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('requests diferentes não compartilham o cache', async () => {
    await request(app.getHttpServer() as Server)
      .get('/probe')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get('/probe')
      .expect(200);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
