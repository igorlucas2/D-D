import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { tap } from 'rxjs';
import { AUDIT_METADATA, type AuditMetadata } from './audit.decorator';
import { AuditService } from './audit.service';

interface AuditRequest extends Request {
  user?: { userId?: string };
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value) return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuditRequest>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap((body: unknown) => {
        const actorId = request.user?.userId;
        if (!actorId) return;

        const campaignId = firstString(
          request.params?.campaignId,
          request.params?.id,
        );
        const resourceId =
          firstString(
            request.params?.mapId,
            request.params?.tokenId,
            request.params?.markerId,
            request.params?.hotspotId,
            request.params?.participantId,
            request.params?.entryId,
            request.params?.eventId,
            request.params?.draftId,
            request.params?.itemId,
            request.params?.turnId,
            request.params?.userId,
          ) ?? (isRecord(body) ? firstString(body.id) : null);

        const headerId = request.headers['x-request-id'];
        const pinoId = (request as Request & { id?: unknown }).id;
        const requestId =
          (typeof pinoId === 'string' ? pinoId : undefined) ??
          (Array.isArray(headerId) ? headerId[0] : headerId) ??
          null;

        const route = request.route as { path?: unknown } | undefined;
        const path =
          typeof route?.path === 'string' ? route.path : request.path;
        void this.audit
          .record({
            campaignId,
            actorId,
            action: metadata.action,
            resource: metadata.resource,
            resourceId,
            summary: `${request.method} ${path}`,
            requestId,
            metadata: {
              method: request.method,
              path,
              params: request.params ?? {},
              bodyKeys: isRecord(request.body)
                ? Object.keys(request.body).sort()
                : [],
              statusCode: response.statusCode,
            },
          })
          .catch((error: unknown) => {
            this.logger.warn(
              `Falha ao registrar auditoria de ${metadata.action}: ${
                error instanceof Error ? error.message : 'erro desconhecido'
              }`,
            );
          });
      }),
    );
  }
}
