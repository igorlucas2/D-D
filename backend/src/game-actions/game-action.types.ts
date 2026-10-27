import Ajv from 'ajv';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
export type ActorContext =
  | { kind: 'USER'; userId: string }
  | { kind: 'AI_MASTER'; initiatedById: string };
export function humanActor(actor: ActorContext) {
  if (actor.kind !== 'USER')
    throw new ForbiddenException('Execução por IA ainda não está habilitada.');
  return actor.userId;
}
export type GameOperation =
  | { kind: 'TRAVEL'; routeId: string }
  | { kind: 'REST'; type: 'SHORT' | 'LONG' }
  | {
      kind: 'TAKE_OBJECT';
      objectId: string;
      carrierId: string;
      visibility: 'MASTER' | 'PUBLIC';
    }
  | { kind: 'DROP_OBJECT'; objectId: string; visibility: 'MASTER' | 'PUBLIC' }
  | { kind: 'ADVANCE_TIME'; minutes: number; reason: string };
export interface GameRequest {
  requestKey: string;
  expectedSceneRevision: number;
  characterEntityId?: string;
  operation: GameOperation;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
const id = { type: 'string', minLength: 1, maxLength: 191 };
const visibility = { enum: ['MASTER', 'PUBLIC'] };
const shape = (kind: string, props: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: ['kind', ...Object.keys(props)],
  properties: { kind: { const: kind }, ...props },
});
const validate = new Ajv().compile({
  oneOf: [
    shape('TRAVEL', { routeId: id }),
    shape('REST', { type: { enum: ['SHORT', 'LONG'] } }),
    shape('TAKE_OBJECT', { objectId: id, carrierId: id, visibility }),
    shape('DROP_OBJECT', { objectId: id, visibility }),
    shape('ADVANCE_TIME', {
      minutes: { type: 'integer', minimum: 1, maximum: 1440 },
      reason: { type: 'string', minLength: 1, maxLength: 1000, pattern: '\\S' },
    }),
  ],
});
export function validateGameOperation(
  value: unknown,
): asserts value is GameOperation {
  if (!validate(value))
    throw new BadRequestException(
      'Ação inválida ou fora dos limites suportados.',
    );
}
