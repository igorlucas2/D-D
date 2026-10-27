import 'reflect-metadata';
import {
  Controller,
  Module,
  Patch,
  type INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { Audit } from './audit.decorator';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

const record = jest.fn();

@Controller('campaigns/:campaignId/probe')
class ProbeController {
  @Audit('probe.update', 'probe')
  @Patch(':mapId')
  update() {
    return { id: 'map-1', ok: true };
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    AuditInterceptor,
    Reflector,
    { provide: AuditService, useValue: { record } },
  ],
})
class ProbeModule {}

describe('AuditInterceptor', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user?: { userId: string } }).user = {
        userId: 'master-1',
      };
      next();
    });
    app.useGlobalInterceptors(app.get(AuditInterceptor));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    record.mockReset();
    record.mockResolvedValue({ id: 'log-1' });
  });

  it('registra ator, campanha, rota e chaves do corpo após sucesso', async () => {
    await request(app.getHttpServer() as Server)
      .patch('/campaigns/campaign-1/probe/map-1')
      .send({ name: 'Novo nome', fog: true })
      .expect(200);

    await new Promise((resolve) => setImmediate(resolve));

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
        actorId: 'master-1',
        action: 'probe.update',
        resource: 'probe',
        resourceId: 'map-1',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- matcher do Jest
        metadata: expect.objectContaining({
          method: 'PATCH',
          bodyKeys: ['fog', 'name'],
          statusCode: 200,
        }),
      }),
    );
  });
});
