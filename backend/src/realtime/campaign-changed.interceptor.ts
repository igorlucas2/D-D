import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { tap } from 'rxjs';
import { VttGateway } from '../vtt/vtt.gateway';
import { CAMPAIGN_CHANGED } from './campaign-changed.decorator';

@Injectable()
export class CampaignChangedInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly gateway: VttGateway,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const changed = this.reflector.getAllAndOverride<boolean>(
      CAMPAIGN_CHANGED,
      [context.getHandler(), context.getClass()],
    );
    if (!changed) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      tap(() => {
        const value = request.params?.campaignId ?? request.params?.id;
        if (typeof value === 'string' && value) {
          this.gateway.emitCampaignUpdated(value);
        }
      }),
    );
  }
}
