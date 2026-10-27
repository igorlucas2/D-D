import Ajv from 'ajv';

export interface AiTurnMemory {
  summary: string;
  openQuestions: string[];
}

export interface AiTurnResult {
  narration: string;
  memory: AiTurnMemory;
  ask: string | null;
}

const id = { type: 'string', minLength: 1, maxLength: 300 };

/** Schema fechado: o modelo não pode devolver campos além destes. */
export const aiTurnSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['narration', 'memory', 'ask'],
  properties: {
    narration: { type: 'string', minLength: 1, maxLength: 4000 },
    memory: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'openQuestions'],
      properties: {
        summary: { type: 'string', minLength: 1, maxLength: 600 },
        openQuestions: {
          type: 'array',
          maxItems: 5,
          uniqueItems: true,
          items: id,
        },
      },
    },
    ask: { type: 'string', maxLength: 500 },
  },
} as const;

const validate = new Ajv({ allErrors: true }).compile(aiTurnSchema);

export class AiTurnValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Turno da IA inválido: ${issues.join('; ')}`);
  }
}

interface RawAiTurn {
  narration: string;
  memory: AiTurnMemory;
  ask: string;
}

function isRawAiTurn(value: unknown): value is RawAiTurn {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const memory = record.memory;
  if (!memory || typeof memory !== 'object' || Array.isArray(memory)) {
    return false;
  }
  const memoryRecord = memory as Record<string, unknown>;
  return (
    typeof record.narration === 'string' &&
    typeof record.ask === 'string' &&
    typeof memoryRecord.summary === 'string' &&
    Array.isArray(memoryRecord.openQuestions) &&
    memoryRecord.openQuestions.every((item) => typeof item === 'string')
  );
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31)
    );
  });
}

function contentIssues(result: AiTurnResult): string[] {
  const issues: string[] = [];
  const narration = result.narration.trim();
  const summary = result.memory.summary.trim();

  if (!narration) issues.push('narration vazia');
  if (!summary) issues.push('memory.summary vazia');
  if (hasControlCharacters(result.narration)) {
    issues.push('narration com caractere de controle');
  }
  if (/<[a-z][^>]*>/i.test(result.narration)) {
    issues.push('narration com HTML');
  }
  if (/https?:\/\//i.test(result.narration)) {
    issues.push('narration com URL');
  }
  if (
    /\b(?:como (?:uma )?ia|sou um modelo|não posso (?:narrar|ajudar))\b/i.test(
      result.narration,
    )
  ) {
    issues.push('narration com meta-discurso');
  }
  if (
    /\b\d+\s*(?:pontos? de vida|pv|de dano)\b/i.test(result.narration) ||
    /você (?:perde|ganha|sofre)\s+\d+/i.test(result.narration)
  ) {
    issues.push('narration com mecânica inventada');
  }

  return issues;
}

export function parseAiTurn(text: string): AiTurnResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AiTurnValidationError(['JSON inválido']);
  }

  if (!validate(value)) {
    throw new AiTurnValidationError(
      (validate.errors ?? []).map(
        (error) =>
          `${error.instancePath || 'raiz'} ${error.message ?? 'inválido'}`,
      ),
    );
  }

  if (!isRawAiTurn(value)) {
    throw new AiTurnValidationError(['Forma inválida']);
  }

  const result = value;
  const issues = contentIssues({
    narration: result.narration,
    memory: result.memory,
    ask: result.ask.trim() || null,
  });
  if (issues.length) throw new AiTurnValidationError(issues);

  return {
    narration: result.narration.trim(),
    memory: {
      summary: result.memory.summary.trim(),
      openQuestions: result.memory.openQuestions
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5),
    },
    ask: result.ask.trim() || null,
  };
}
