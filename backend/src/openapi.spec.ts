import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { buildOpenApiDocument, isOpenApiEnabled } from './openapi';

@Controller('probe')
class ProbeController {
  @Get()
  list() {
    return [];
  }
}

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  OPENAPI_ENABLED: process.env.OPENAPI_ENABLED,
};

function restore(key: 'NODE_ENV' | 'OPENAPI_ENABLED') {
  const value = originalEnv[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe('isOpenApiEnabled', () => {
  afterEach(() => {
    restore('NODE_ENV');
    restore('OPENAPI_ENABLED');
  });

  it('fica desligado em produção por padrão', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.OPENAPI_ENABLED;
    expect(isOpenApiEnabled()).toBe(false);
  });

  it('liga em desenvolvimento ou com OPENAPI_ENABLED=1', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.OPENAPI_ENABLED;
    expect(isOpenApiEnabled()).toBe(true);

    process.env.NODE_ENV = 'production';
    process.env.OPENAPI_ENABLED = '1';
    expect(isOpenApiEnabled()).toBe(true);
  });

  it('respeita OPENAPI_ENABLED=0', () => {
    process.env.NODE_ENV = 'development';
    process.env.OPENAPI_ENABLED = '0';
    expect(isOpenApiEnabled()).toBe(false);
  });
});

describe('buildOpenApiDocument', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('descreve a API e o esquema de autenticação', () => {
    const document = buildOpenApiDocument(app);

    expect(document.info.title).toBe('Eldoria RPG API');
    expect(document.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(document.paths['/probe']?.get).toBeDefined();
  });
});
