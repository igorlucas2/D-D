import Ajv from 'ajv';
import type { CopilotContext } from './game-master.context';
export type TurnKind = 'PLAN' | 'NPC' | 'PUBLIC';
export interface Proposal {
  kind: 'ANSWER' | 'ASK' | 'TRAVEL' | 'REST' | 'DISCOVER';
  text: string;
  evidenceIds: string[];
  routeId: string | null;
  restType: 'SHORT' | 'LONG' | null;
  revisionId: string | null;
  knowerIds: string[];
  sourceNpcId: string | null;
}
const id = { type: 'string', minLength: 1, maxLength: 191 };
export const proposalSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'kind',
    'text',
    'evidenceIds',
    'routeId',
    'restType',
    'revisionId',
    'knowerIds',
    'sourceNpcId',
  ],
  properties: {
    kind: { enum: ['ANSWER', 'ASK', 'TRAVEL', 'REST', 'DISCOVER'] },
    text: { type: 'string', minLength: 1, maxLength: 2000 },
    evidenceIds: { type: 'array', items: id, maxItems: 12, uniqueItems: true },
    routeId: { anyOf: [id, { type: 'null' }] },
    restType: { enum: ['SHORT', 'LONG', null] },
    revisionId: { anyOf: [id, { type: 'null' }] },
    knowerIds: { type: 'array', items: id, maxItems: 8, uniqueItems: true },
    sourceNpcId: { anyOf: [id, { type: 'null' }] },
  },
};
const validate = new Ajv().compile<Proposal>(proposalSchema);
// Large repetition bounds can fail Ollama's grammar compiler. Enforce those
// limits with Ajv after generation; retain closed fields and enums in the model.
export function generationSchema(context: CopilotContext) {
  const refs = context.sources.map((s) => s.id);
  const sources = refs.length
    ? { type: 'array', items: { type: 'string', enum: refs } }
    : { const: [] };
  const variant = (
    kind: Proposal['kind'],
    fields: Record<string, unknown> = {},
  ) => ({
    type: 'object',
    additionalProperties: false,
    required: proposalSchema.required,
    properties: {
      kind: { const: kind },
      text: { type: 'string' },
      evidenceIds: sources,
      routeId: { type: 'null' },
      restType: { type: 'null' },
      revisionId: { type: 'null' },
      knowerIds: { const: [] },
      sourceNpcId: { type: 'null' },
      ...fields,
    },
  });
  const variants = [variant('ANSWER'), variant('ASK')];
  if (context.kind === 'PLAN') {
    if (context.routes.length)
      variants.push(
        variant('TRAVEL', {
          routeId: { type: 'string', enum: context.routes.map((r) => r.id) },
          evidenceIds: { const: [] },
        }),
      );
    variants.push(
      variant('REST', {
        restType: { type: 'string', enum: ['SHORT', 'LONG'] },
        evidenceIds: { const: [] },
      }),
    );
    const known = context.sources.filter(
      (s) => s.npcId === context.npc?.id && s.revisionId,
    );
    if (context.npc && known.length && context.participants.length)
      variants.push(
        variant('DISCOVER', {
          evidenceIds: {
            type: 'array',
            items: { type: 'string', enum: known.map((s) => s.id) },
          },
          sourceNpcId: { const: context.npc.id },
          revisionId: { type: 'string', enum: known.map((s) => s.revisionId) },
          knowerIds: {
            type: 'array',
            items: {
              type: 'string',
              enum: context.participants.map((p) => p.id),
            },
          },
        }),
      );
  }
  return { oneOf: variants };
}
export function parseProposal(text: string): Proposal {
  const value: unknown = JSON.parse(text);
  if (!validate(value) || !value.text.trim()) throw new Error('INVALID_SCHEMA');
  return value;
}
