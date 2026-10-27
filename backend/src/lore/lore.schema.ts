import Ajv from 'ajv';
import type { LorePack } from './lore.types';

// Draft-07 schemas. Every property is required unless explicitly nullable.
const text = { type: 'string', minLength: 1, maxLength: 8000 };
const id = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9-]{0,79}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const enumOf = (...values: (string | number | boolean)[]) => ({ enum: values });
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const integer = (minimum = 0, maximum = 1000000) => ({
  type: 'integer',
  minimum,
  maximum,
});
const array = (items: object, minItems = 0) => ({
  type: 'array',
  items,
  minItems,
  maxItems: 1000,
});
const object = (properties: Record<string, object>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const binding = object({ source: id, srdIndex: id });
const route = object({
  from: id,
  to: id,
  minutes: integer(1),
  bidirectional: enumOf(true),
});
const audience = enumOf('PUBLIC', 'MASTER');
const strings = array(text);
export const loreSchemas = {
  manifest: object({
    formatVersion: enumOf(1),
    packId: id,
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    status: enumOf('DRAFT', 'PUBLISHED'),
    files: array(
      object({
        path: {
          type: 'string',
          pattern:
            '^(?:[a-z][a-z0-9-]*\\.json|assets/[a-z][a-z0-9-]*\\.(?:svg|png))$',
        },
        sha256: hash,
        audience,
      }),
      1,
    ),
    sources: array(
      object({ title: text, reference: text, sha256: nullable(hash) }),
      1,
    ),
    rules: object({
      profile: enumOf('SRD_2014'),
      combat: enumOf('MANUAL'),
      moneyEnabled: enumOf(false),
      publicationBlockers: strings,
    }),
  }),
  public: object({
    title: text,
    premise: text,
    tone: text,
    hooks: array(text, 1),
    playerHistoryPolicy: text,
    opening: text,
    start: object({
      year: integer(),
      month: integer(1, 12),
      monthName: text,
      day: integer(1, 31),
      hour: integer(0, 23),
      minute: integer(0, 59),
    }),
    party: object({
      minPlayers: integer(1, 10),
      maxPlayers: integer(1, 10),
      startLevel: integer(1, 20),
      endLevel: integer(1, 20),
    }),
  }),
  entities: object({
    places: array(
      object({ id, name: text, parentId: nullable(id), description: text }),
      1,
    ),
    factions: array(object({ id, name: text, objective: text, limits: text })),
    npcs: array(
      object({
        id,
        name: text,
        placeId: id,
        factionId: nullable(id),
        objective: text,
        voice: text,
        knowledgeBoundary: text,
        catalog: binding,
      }),
      1,
    ),
    objects: array(object({ id, name: text, placeId: id, state: text })),
    relations: array(
      object({
        from: id,
        to: id,
        kind: enumOf(
          'TRUSTS',
          'FRIEND',
          'RESPECTS',
          'OWES_PAYMENT',
          'DISTRUSTS',
        ),
      }),
    ),
  }),
  facts: object({
    facts: array(
      object({
        id,
        text,
        mutability: enumOf('FIXED', 'INITIAL_STATE'),
        audience,
        subjects: array(id),
      }),
      1,
    ),
    claims: array(
      object({
        id,
        text,
        truth: enumOf('TRUE', 'TRUE_IMPRECISE', 'FALSE'),
        factIds: array(id, 1),
      }),
    ),
    knowledge: array(
      object({
        npcId: id,
        targetId: id,
        stance: enumOf('KNOWS', 'BELIEVES', 'SUSPECTS'),
        source: text,
      }),
    ),
    improvisation: object({
      allowed: strings,
      requiresValidatedEvent: strings,
    }),
  }),
  history: array(
    object({
      id,
      timeLabel: text,
      relativeMinutes: nullable(integer(-100000000, 0)),
      precision: enumOf('APPROXIMATE_YEARS', 'DAY', 'MINUTE'),
      text,
      audience,
      knowledgeNote: text,
    }),
  ),
  threads: object({
    threads: array(
      object({ id, objective: text, completion: text, consequence: text }),
      1,
    ),
    clues: array(
      object({
        id,
        conclusion: text,
        factIds: array(id, 1),
        alternatives: array(object({ holderId: id, text }), 2),
      }),
    ),
    pressures: array(
      object({
        id,
        afterMinutes: integer(1),
        afterEventId: nullable(id),
        condition: text,
        effect: text,
        subjects: array(id, 1),
      }),
    ),
    repairs: array(
      object({
        id,
        placeId: id,
        objectId: id,
        minutes: integer(1),
        conditions: array(text, 1),
        effect: text,
      }),
    ),
    rewards: array(
      object({
        threadId: id,
        kind: enumOf('LODGING', 'MONEY'),
        quantity: nullable(integer(1)),
        unit: enumOf('DAYS', 'UNDEFINED'),
        beneficiary: enumOf('GROUP'),
        enabled: { type: 'boolean' },
      }),
    ),
    resolutions: strings,
    guidance: strings,
  }),
  atlas: object({
    geometry: array(
      object({
        mapId: id,
        entry: object({ x: integer(), y: integer() }),
        walls: array({
          type: 'object',
          additionalProperties: false,
          required: ['x1', 'y1', 'x2', 'y2'],
          properties: {
            x1: integer(),
            y1: integer(),
            x2: integer(),
            y2: integer(),
            door: enumOf('open', 'closed'),
          },
        }),
      }),
    ),
    coordinateSystem: text,
    maps: array(
      object({
        id,
        name: text,
        kind: enumOf('REGION', 'SETTLEMENT', 'INTERIOR'),
        parentId: nullable(id),
        width: integer(1, 500),
        height: integer(1, 500),
        gridSize: integer(1, 100),
        asset: text,
        texture: text,
        visibility: enumOf('PUBLIC_AT_START', 'KNOWN_PLAN_ON_DISCOVERY'),
        scale: text,
      }),
      1,
    ),
    places: array(
      object({
        id,
        name: text,
        mapId: id,
        x: integer(),
        y: integer(),
        targetMapId: nullable(id),
      }),
    ),
    rooms: array(
      object({
        id,
        mapId: id,
        name: text,
        x: integer(),
        y: integer(),
        width: integer(1),
        height: integer(1),
      }),
    ),
    routes: array(route),
    localTravel: array(route),
  }),
  encounters: array(
    object({
      id,
      placeId: nullable(id),
      catalog: binding,
      availability: enumOf('LATER_ARC', 'OPTIONAL'),
      resolution: enumOf('MANUAL'),
      usage: text,
    }),
  ),
} satisfies Record<keyof LorePack, object>;

const ajv = new Ajv({ allErrors: true, strict: true });
export const loreValidators = Object.fromEntries(
  Object.entries(loreSchemas).map(([key, schema]) => [
    key,
    ajv.compile(schema),
  ]),
);
