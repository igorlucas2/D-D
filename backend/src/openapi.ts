import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

/**
 * Documentação interativa da API.
 *
 * Em produção fica desligada por padrão (evita expor o mapa da API); para
 * publicar, defina `OPENAPI_ENABLED=1`. Em desenvolvimento/teste o padrão é
 * ligada. O JSON também alimenta os tipos do frontend via
 * `docs/openapi.json`.
 */
export function isOpenApiEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = env.OPENAPI_ENABLED?.trim().toLowerCase();
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Eldoria RPG API')
    .setDescription(
      [
        'API da plataforma Eldoria: autenticação, campanhas, fichas, mesa',
        'virtual, combate, mundo vivo e memória da campanha.',
        '',
        'Autenticação: `Authorization: Bearer <token>` obtido em `POST /api/auth/login`.',
        'Os eventos em tempo real usam Socket.IO nos namespaces `/vtt` e `/world`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token retornado pelo login ou cadastro.',
      },
      'bearer',
    )
    .addTag('auth', 'Cadastro, login e perfil')
    .addTag('campaigns', 'Campanhas, convites e membros')
    .addTag('characters', 'Fichas, inventário, magias e progressão')
    .addTag('catalog', 'Catálogo SRD e biblioteca')
    .addTag('dice', 'Rolagens de dados')
    .addTag('vtt', 'Mapas, tokens, névoa e presença na mesa')
    .addTag('combat', 'Encontros e iniciativa')
    .addTag('world', 'Calendário, clima e eventos do mundo')
    .addTag('journal', 'Diário e memória da campanha')
    .addTag('story', 'Eventos, fatos e conhecimento')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupOpenApi(app: INestApplication): void {
  if (!isOpenApiEnabled()) return;

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    customSiteTitle: 'Eldoria RPG API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
