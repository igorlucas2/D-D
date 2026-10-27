import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Restringe a ação a administradores quando ADMIN_EMAILS está configurado.
 * Sem a variável, mantém o comportamento anterior (qualquer conta autenticada),
 * porque o projeto ainda não tem um modelo de papéis global.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { email?: string } }>();
    const email = request.user?.email?.trim().toLowerCase() ?? '';

    if (!allowed.includes(email)) {
      throw new ForbiddenException(
        'Apenas administradores podem executar esta ação.',
      );
    }

    return true;
  }
}
