import 'reflect-metadata';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';

function configWith(value: string | undefined) {
  return {
    get: () => value,
  } as unknown as ConfigService;
}

function contextFor(email?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: email ? { email } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it('permite qualquer conta autenticada quando ADMIN_EMAILS não existe', () => {
    const guard = new AdminGuard(configWith(undefined));
    expect(guard.canActivate(contextFor('qualquer@example.com'))).toBe(true);
  });

  it('restringe à lista configurada', () => {
    const guard = new AdminGuard(
      configWith('admin@example.com, mestre@example.com'),
    );

    expect(guard.canActivate(contextFor('admin@example.com'))).toBe(true);
    expect(() => guard.canActivate(contextFor('jogador@example.com'))).toThrow(
      ForbiddenException,
    );
  });

  it('ignora caixa e espaços nos e-mails', () => {
    const guard = new AdminGuard(configWith(' Admin@Example.com '));
    expect(guard.canActivate(contextFor('ADMIN@example.com'))).toBe(true);
  });

  it('recusa quando não há usuário na requisição', () => {
    const guard = new AdminGuard(configWith('admin@example.com'));
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
