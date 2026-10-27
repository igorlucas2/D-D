import { randomUUID } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Logs estruturados em JSON, com request id em toda linha e sem credenciais.
 * O id vem de `x-request-id` quando o proxy já gerou um; senão é criado aqui e
 * devolvido no cabeçalho da resposta (também aparece no corpo dos erros).
 */
export const LoggingModule = LoggerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.get<string>('LOG_LEVEL') ?? 'info',
      genReqId: (req, res) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        const id =
          typeof incoming === 'string' &&
          incoming.length > 0 &&
          incoming.length <= 128
            ? incoming
            : randomUUID();
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },
      customProps: () => ({ service: 'eldoria-api' }),
      // O monitor consulta /health a cada 10 s; não polui o log.
      autoLogging: {
        ignore: (req) => (req.url ?? '').startsWith('/api/health'),
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
        ],
        censor: '[redacted]',
      },
      serializers: {
        req: (req: {
          id?: string;
          method?: string;
          url?: string;
          remoteAddress?: string;
        }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res: { statusCode?: number }) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  }),
});
