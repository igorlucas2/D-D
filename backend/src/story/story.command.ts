import Ajv from 'ajv';
import { BadRequestException } from '@nestjs/common';

export type AudienceInput = {
  scope: 'MASTER' | 'PUBLIC' | 'RECIPIENTS';
  recipientIds: string[];
};
type Visible = { audience: AudienceInput };
export type StoryOperation =
  | ({ kind: 'NOTE'; text: string; entityIds: string[] } & Visible)
  | ({
      kind: 'FACT_CREATE';
      key: string;
      text: string;
      factKind: 'FACT' | 'CLAIM';
      classification: 'FIXED' | 'MUTABLE';
      entityIds: string[];
    } & Visible)
  | ({
      kind: 'FACT_UPDATE' | 'CORRECTION';
      factId: string;
      text: string;
      reason: string;
    } & Visible)
  | {
      kind: 'DISCOVER';
      revisionId: string;
      knowerIds: string[];
      stance: 'KNOWN' | 'BELIEVED' | 'SUSPECTED';
      source: string;
    }
  | ({
      kind: 'RELATIONSHIP';
      fromId: string;
      toId: string;
      trust: number;
      fear: number;
      description: string;
    } & Visible)
  | ({
      kind: 'PROMISE_CREATE';
      giverId: string;
      receiverId: string;
      terms: string;
    } & Visible)
  | {
      kind: 'PROMISE_RESOLVE';
      promiseId: string;
      status: 'FULFILLED' | 'BROKEN' | 'CANCELLED';
      reason: string;
    }
  | ({
      kind: 'THREAD_UPDATE';
      threadId: string;
      status: 'OPEN' | 'RESOLVED' | 'ABANDONED';
      reason: string;
    } & Visible);
export interface StoryCommand {
  requestKey: string;
  expectedRevision: number;
  operation: StoryOperation;
}
const str = (maxLength: number) => ({
  type: 'string',
  minLength: 1,
  maxLength,
  pattern: '\\S',
});
const id = str(191);
const ids = { type: 'array', items: id, uniqueItems: true, maxItems: 40 };
const audience = {
  type: 'object',
  additionalProperties: false,
  required: ['scope', 'recipientIds'],
  properties: {
    scope: { enum: ['MASTER', 'PUBLIC', 'RECIPIENTS'] },
    recipientIds: ids,
  },
};
const shape = (kind: string, properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: ['kind', ...Object.keys(properties)],
  properties: { kind: { const: kind }, ...properties },
});
const validate = new Ajv().compile({
  oneOf: [
    shape('NOTE', { text: str(4000), entityIds: ids, audience }),
    shape('FACT_CREATE', {
      key: { ...str(80), pattern: '^[A-Za-z0-9_-]+$' },
      text: str(6000),
      factKind: { enum: ['FACT', 'CLAIM'] },
      classification: { enum: ['FIXED', 'MUTABLE'] },
      entityIds: ids,
      audience,
    }),
    ...['FACT_UPDATE', 'CORRECTION'].map((kind) =>
      shape(kind, { factId: id, text: str(6000), reason: str(2000), audience }),
    ),
    shape('DISCOVER', {
      revisionId: id,
      knowerIds: { ...ids, minItems: 1 },
      stance: { enum: ['KNOWN', 'BELIEVED', 'SUSPECTED'] },
      source: str(2000),
    }),
    shape('RELATIONSHIP', {
      fromId: id,
      toId: id,
      trust: { type: 'integer', minimum: -100, maximum: 100 },
      fear: { type: 'integer', minimum: 0, maximum: 100 },
      description: str(2000),
      audience,
    }),
    shape('PROMISE_CREATE', {
      giverId: id,
      receiverId: id,
      terms: str(2000),
      audience,
    }),
    shape('PROMISE_RESOLVE', {
      promiseId: id,
      status: { enum: ['FULFILLED', 'BROKEN', 'CANCELLED'] },
      reason: str(2000),
    }),
    shape('THREAD_UPDATE', {
      threadId: id,
      status: { enum: ['OPEN', 'RESOLVED', 'ABANDONED'] },
      reason: str(2000),
      audience,
    }),
  ],
});
export function validateOperation(
  value: unknown,
): asserts value is StoryOperation {
  if (!validate(value))
    throw new BadRequestException(
      'Operação narrativa inválida. Confira os campos e limites.',
    );
}
