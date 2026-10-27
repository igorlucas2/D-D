import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA = 'eldoria:audit';

export interface AuditMetadata {
  action: string;
  resource: string;
}

/**
 * Marca uma rota para auditoria. O interceptor registra só depois de a ação
 * ter sucesso; corpo e valores sensíveis não são gravados.
 */
export const Audit = (action: string, resource: string) =>
  SetMetadata(AUDIT_METADATA, { action, resource } satisfies AuditMetadata);
