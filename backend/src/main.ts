import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { allowedOrigins } from './config/cors';
import { RequestContextService } from './common/request-context.service';
import { setupOpenApi } from './openapi';

/** Loopback em IPv4, IPv6 e no formato mapeado que o Node entrega. */
function isLoopback(address: string): boolean {
  const value = address.startsWith('::ffff:') ? address.slice(7) : address;
  return value === '::1' || value === '127.0.0.1' || value.startsWith('127.');
}

async function bootstrap() {
  // O parser padrão (100 kB) é substituído abaixo por um limite explícito.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useLogger(app.get(PinoLogger));

  // O contexto abaixo é herdado por todo o restante da requisição: serviços
  // podem memorizar a checagem de campanha sem virar request-scoped.
  const requestContext = app.get(RequestContextService);
  app.use((_request: Request, _response: Response, next: NextFunction) => {
    requestContext.run(next);
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Cabeçalhos de segurança e compressão. CSP é responsabilidade do Next, que
  // entrega o HTML; aqui desligamos para não afetar respostas JSON.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());

  // Mapas com névoa e paredes chegam em JSON; 1 MB cobre o maior caso sem
  // aceitar payloads absurdos.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // O navegador fala com o Next (mesma origem). Só as origens conhecidas
  // recebem CORS; túnel/domínio próprio entram por ELDORIA_ALLOWED_ORIGINS.
  app.enableCors({
    origin: allowedOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  app.disable('x-powered-by');
  app.enableShutdownHooks();

  // Documentação em /api/docs (desligada em produção sem OPENAPI_ENABLED=1).
  setupOpenApi(app);
  // Atrás do proxy do Next (mesma máquina), confiar só em proxy loopback faz
  // req.ip refletir o cliente real sem aceitar X-Forwarded-For de fora.
  // A checagem é explícita porque o Node entrega `::ffff:127.0.0.1`, que não
  // casa com o preset "loopback" do Express.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === '1') app.set('trust proxy', 1);
  else if (trustProxy === '0' || trustProxy === 'false')
    app.set('trust proxy', false);
  else app.set('trust proxy', (address: string) => isLoopback(address));

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
