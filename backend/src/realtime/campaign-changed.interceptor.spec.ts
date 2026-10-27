import 'reflect-metadata';
import {
  Controller,
  Module,
  Patch,
  type INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { VttGateway } from '../vtt/vtt.gateway';
import { CampaignChanged } from './campaign-changed.decorator';
import { CampaignChangedInterceptor } from './campaign-changed.interceptor';

const emitCampaignUpdated = jest.fn();

@Controller('campaigns/:campaignId/probe')
class ProbeController {
  @CampaignChanged()
  @Patch()
  changed() {
    return { ok: true };
  }
}

@Controller('campaigns/:campaignId/quiet')
class QuietController {
  @Patch()
  quiet() {
    return { ok: true };
  }
}

@Module({
  controllers: [ProbeController, QuietController],
  providers: [
    CampaignChangedInterceptor,
    Reflector,
    {
      provide: VttGateway,
      useValue: { emitCampaignUpdated },
    },
  ],
})
class ProbeModule {}

describe('CampaignChangedInterceptor', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(app.get(CampaignChangedInterceptor));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    emitCampaignUpdated.mockReset();
  });

  it('emite table:state para a campanha anotada', async () => {
    await request(app.getHttpServer() as Server)
      .patch('/campaigns/campaign-1/probe')
      .expect(200);

    expect(emitCampaignUpdated).toHaveBeenCalledWith('campaign-1');
  });

  it('não emite para rotas sem a anotação', async () => {
    await request(app.getHttpServer() as Server)
      .patch('/campaigns/campaign-1/quiet')
      .expect(200);

    expect(emitCampaignUpdated).not.toHaveBeenCalled();
  });
});
