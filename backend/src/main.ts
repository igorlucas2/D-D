import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { allowedOrigins } from './config/cors';

async function bootstrap() {
  // O parser padrão (100 kB) é substituído abaixo por um limite explícito.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
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
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
