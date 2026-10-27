import Anthropic from '@anthropic-ai/sdk';
import { HttpException } from '@nestjs/common';
import {
  ASSISTANT_MODEL,
  AssistantService,
  type AssistantClient,
} from './assistant.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WorldService } from '../world/world.service';

// O cliente da API é simulado: nenhum teste faz chamada real nem gera custo.

const campaign = {
  id: 'c1',
  name: 'Coroa de Cinzas',
  description: 'Intriga na fronteira',
  masterId: 'mestre',
  assistantEnabled: true,
  assistantMonthlyLimit: 3,
};

function setup(
  overrides: {
    client?: AssistantClient | 'none';
    campaign?: Partial<typeof campaign>;
    used?: number;
    response?: Partial<Anthropic.Beta.Messages.BetaMessage>;
    error?: unknown;
  } = {},
) {
  const create = jest.fn(() =>
    overrides.error
      ? Promise.reject(overrides.error as Error)
      : Promise.resolve({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'A névoa cobre a praça.' }],
          usage: { input_tokens: 420, output_tokens: 180 },
          ...overrides.response,
        }),
  );
  const client =
    overrides.client === 'none'
      ? null
      : (overrides.client ??
        ({ beta: { messages: { create } } } as unknown as AssistantClient));
  const requestCreate = jest.fn(() => Promise.resolve({}));
  const prisma = {
    campaign: {
      findUnique: jest.fn(() =>
        Promise.resolve({ ...campaign, ...overrides.campaign }),
      ),
    },
    assistantRequest: {
      count: jest.fn(() => Promise.resolve(overrides.used ?? 0)),
      aggregate: jest.fn(() =>
        Promise.resolve({
          _count: overrides.used ?? 0,
          _sum: { inputTokens: 1200, outputTokens: 300 },
        }),
      ),
      create: requestCreate,
    },
    campaignWorldEntry: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { type: 'REINO', name: 'Valdor', summary: 'Reino do norte' },
        ]),
      ),
    },
    campaignJournalEntry: {
      findMany: jest.fn(() => Promise.resolve([{ title: 'A ponte caiu' }])),
    },
    vttMap: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          name: 'Praça do Mercado',
          kind: 'SETTLEMENT',
          hotspots: [{ label: 'Taverna' }],
          tokens: [{ name: 'Lira' }],
        }),
      ),
    },
  };
  const world = {
    getCalendar: jest.fn(() =>
      Promise.resolve({
        currentHour: 20,
        currentDay: 3,
        currentMonth: 1,
        monthNames: ['Colheita'],
        weather: 'fog',
      }),
    ),
  };
  const service = new AssistantService(
    prisma as unknown as PrismaService,
    world as unknown as WorldService,
    client,
  );
  return { service, create, requestCreate };
}

const status = async (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error: unknown) =>
      error instanceof HttpException ? error.getStatus() : 'outro',
  );

describe('AssistantService', () => {
  it('só o mestre usa', async () => {
    const { service, create } = setup();
    expect(await status(service.ask('c1', 'jogador', { kind: 'scene' }))).toBe(
      403,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('sem chave configurada fica indisponível', async () => {
    const { service } = setup({ client: 'none' });
    expect(await status(service.ask('c1', 'mestre', { kind: 'scene' }))).toBe(
      503,
    );
    expect(await service.status('c1', 'mestre')).toMatchObject({
      available: false,
      enabled: true,
      monthlyLimit: 3,
      tokensThisMonth: { input: 1200, output: 300 },
    });
  });

  it('desligado na campanha não chama a API', async () => {
    const { service, create } = setup({
      campaign: { assistantEnabled: false },
    });
    expect(await status(service.ask('c1', 'mestre', { kind: 'scene' }))).toBe(
      403,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('pedidos livres e de nomes exigem texto', async () => {
    const { service } = setup();
    expect(
      await status(
        service.ask('c1', 'mestre', { kind: 'names', prompt: '  ' }),
      ),
    ).toBe(400);
  });

  it('respeita o limite mensal', async () => {
    const { service, create } = setup({ used: 3 });
    expect(await status(service.ask('c1', 'mestre', { kind: 'scene' }))).toBe(
      429,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('envia o contexto da campanha e registra o uso', async () => {
    const { service, create, requestCreate } = setup();
    const result = await service.ask('c1', 'mestre', {
      kind: 'npc',
      mapId: 'm1',
    });
    expect(result.text).toBe('A névoa cobre a praça.');
    const params = (create.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(params.model).toBe(ASSISTANT_MODEL);
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(params.thinking).toEqual({ type: 'adaptive' });
    const message = JSON.stringify(params.messages);
    for (const expected of [
      'Coroa de Cinzas',
      'Praça do Mercado',
      'neblina',
      'noite',
      'Valdor',
      'Taverna',
      'A ponte caiu',
    ]) {
      expect(message).toContain(expected);
    }
    expect(requestCreate.mock.calls[0]).toMatchObject([
      {
        data: {
          kind: 'npc',
          inputTokens: 420,
          outputTokens: 180,
          refused: false,
        },
      },
    ]);
  });

  it('recusa vira erro claro e fica registrada', async () => {
    const { service, requestCreate } = setup({
      response: { stop_reason: 'refusal', content: [] },
    });
    expect(await status(service.ask('c1', 'mestre', { kind: 'scene' }))).toBe(
      422,
    );
    expect(requestCreate.mock.calls[0]).toMatchObject([
      { data: { refused: true } },
    ]);
  });

  it('erros da API viram mensagens úteis', async () => {
    const auth = setup({
      error: new Anthropic.AuthenticationError(
        401,
        undefined,
        'invalid x-api-key',
        new Headers(),
      ),
    });
    expect(
      await status(auth.service.ask('c1', 'mestre', { kind: 'scene' })),
    ).toBe(503);
    const limited = setup({
      error: new Anthropic.RateLimitError(
        429,
        undefined,
        'rate limited',
        new Headers(),
      ),
    });
    expect(
      await status(limited.service.ask('c1', 'mestre', { kind: 'scene' })),
    ).toBe(429);
  });
});
