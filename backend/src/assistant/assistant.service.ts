import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { WorldService } from '../world/world.service';
import { AskAssistantDto, type AssistantKind } from './dto/assistant.dto';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');
export const ASSISTANT_MODEL = 'claude-opus-5-5';

const WORLD_ENTRIES_LIMIT = 25;
const JOURNAL_TITLES_LIMIT = 6;

const SYSTEM_PROMPT = `Você ajuda o mestre de uma mesa de RPG de fantasia medieval. O sistema é próprio, inspirado em D&D 5e: não copie texto, monstros, lugares ou personagens protegidos por direitos autorais; crie material original.

Escreva em português do Brasil, pronto para usar na mesa: frases que o mestre possa ler em voz alta ou consultar de relance. Seja concreto e sensorial, sem floreio. Use o contexto da campanha que vier na mensagem (lugar, hora, clima, entradas do mundo) e não contradiga o que ele estabelece. Se faltar contexto, invente detalhes coerentes em vez de pedir mais informação.

Formato: texto simples, parágrafos curtos ou listas com hífen. Sem títulos em markdown, sem negrito, sem comentários sobre o próprio texto.`;

const KIND_INSTRUCTIONS: Record<AssistantKind, string> = {
  scene:
    'Descreva a cena atual para os jogadores em dois ou três parágrafos curtos: o que veem, ouvem e cheiram, e um detalhe que convide à ação.',
  npc: 'Improvise um personagem do mestre (NPC) que caiba neste lugar. Traga: nome, aparência em uma frase, jeito de falar, o que quer agora, um segredo e uma fala de exemplo.',
  names:
    'Sugira 10 nomes coerentes com o mundo para o que o mestre pediu, um por linha, cada um com uma nota curta.',
  free: 'Atenda ao pedido do mestre.',
};

const DAY_PHASES: [number, string][] = [
  [4, 'madrugada'],
  [6, 'alvorada'],
  [16, 'dia'],
  [18, 'crepúsculo'],
  [23, 'noite'],
];

const WEATHER_LABELS: Record<string, string> = {
  clear: 'céu limpo',
  cloudy: 'nublado',
  rain: 'chuva',
  storm: 'tempestade',
  fog: 'neblina',
  snow: 'neve',
  wind: 'ventania',
};

/** Cliente da API, ou null quando o servidor não tem chave configurada. */
export type AssistantClient = Pick<Anthropic, 'beta'> | null;

// Assistente do mestre (IM-12). Só o mestre usa, só quando liga na campanha,
// com limite mensal de pedidos. O texto gerado volta apenas para o mestre:
// publicar continua sendo uma ação explícita (narração, IM-06).
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly worldService: WorldService,
    @Inject(ANTHROPIC_CLIENT) private readonly client: AssistantClient,
  ) {}

  async status(campaignId: string, userId: string) {
    const campaign = await this.assertIsMaster(campaignId, userId);
    const usage = await this.prisma.assistantRequest.aggregate({
      where: { campaignId, createdAt: { gte: this.monthStart() } },
      _count: true,
      _sum: { inputTokens: true, outputTokens: true },
    });
    return {
      available: this.client !== null,
      enabled: campaign.assistantEnabled,
      monthlyLimit: campaign.assistantMonthlyLimit,
      usedThisMonth: usage._count,
      tokensThisMonth: {
        input: usage._sum.inputTokens ?? 0,
        output: usage._sum.outputTokens ?? 0,
      },
      model: ASSISTANT_MODEL,
    };
  }

  async updateSettings(
    campaignId: string,
    userId: string,
    settings: { enabled?: boolean; monthlyLimit?: number },
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        assistantEnabled: settings.enabled,
        assistantMonthlyLimit: settings.monthlyLimit,
      },
    });
    return this.status(campaignId, userId);
  }

  async ask(campaignId: string, userId: string, dto: AskAssistantDto) {
    const campaign = await this.assertIsMaster(campaignId, userId);
    if (!this.client) {
      throw new ServiceUnavailableException(
        'O assistente não está configurado neste servidor (falta a chave da API).',
      );
    }
    if (!campaign.assistantEnabled) {
      throw new ForbiddenException(
        'Ligue o assistente nas configurações da campanha antes de usar.',
      );
    }
    const prompt = dto.prompt?.trim() ?? '';
    if ((dto.kind === 'names' || dto.kind === 'free') && !prompt) {
      throw new BadRequestException('Diga ao assistente o que você quer.');
    }
    const used = await this.prisma.assistantRequest.count({
      where: { campaignId, createdAt: { gte: this.monthStart() } },
    });
    if (used >= campaign.assistantMonthlyLimit) {
      throw new HttpException(
        `Limite de ${campaign.assistantMonthlyLimit} pedidos por mês atingido. Aumente o limite nas configurações do assistente.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const context = await this.buildContext(campaign, userId, dto.mapId);
    const userMessage = [
      context,
      `Tarefa: ${KIND_INSTRUCTIONS[dto.kind]}`,
      prompt ? `Pedido do mestre: ${prompt}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    let response: Anthropic.Beta.Messages.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        // Texto criativo curto: esforço médio basta e mantém o custo baixo.
        output_config: { effort: 'medium' },
        // Recusa de segurança: tenta de novo no modelo recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (error) {
      throw this.translateError(error);
    }

    const refused = response.stop_reason === 'refusal';
    await this.prisma.assistantRequest.create({
      data: {
        campaignId,
        userId,
        kind: dto.kind,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        refused,
      },
    });
    if (refused) {
      throw new UnprocessableEntityException(
        'O assistente recusou este pedido. Tente reformular.',
      );
    }

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    return {
      text,
      truncated: response.stop_reason === 'max_tokens',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  /**
   * Contexto enviado à API: só o necessário para a resposta caber no mundo.
   * É o que sai do servidor quando o mestre pede algo (ver aviso na interface).
   */
  private async buildContext(
    campaign: { id: string; name: string; description: string | null },
    userId: string,
    mapId?: string,
  ) {
    const [calendar, entries, journal, map] = await Promise.all([
      this.worldService.getCalendar(campaign.id, userId),
      this.prisma.campaignWorldEntry.findMany({
        where: { campaignId: campaign.id },
        select: { type: true, name: true, summary: true },
        orderBy: { updatedAt: 'desc' },
        take: WORLD_ENTRIES_LIMIT,
      }),
      this.prisma.campaignJournalEntry.findMany({
        where: { campaignId: campaign.id },
        select: { title: true },
        orderBy: { createdAt: 'desc' },
        take: JOURNAL_TITLES_LIMIT,
      }),
      mapId
        ? this.prisma.vttMap.findFirst({
            where: { id: mapId, campaignId: campaign.id },
            select: {
              name: true,
              kind: true,
              hotspots: { select: { label: true } },
              tokens: { select: { name: true } },
            },
          })
        : null,
    ]);
    if (mapId && !map) throw new NotFoundException('Mapa não encontrado.');

    const phase =
      DAY_PHASES.find(([limit]) => calendar.currentHour <= limit)?.[1] ??
      'noite';
    const month =
      calendar.monthNames[calendar.currentMonth - 1] ??
      `mês ${calendar.currentMonth}`;
    const lines = [
      `Campanha: ${campaign.name}${campaign.description ? ` - ${campaign.description}` : ''}`,
      `Momento: ${phase}, dia ${calendar.currentDay} de ${month}; clima: ${WEATHER_LABELS[calendar.weather] ?? calendar.weather}.`,
    ];
    if (map) {
      lines.push(`Lugar atual: ${map.name} (${map.kind.toLowerCase()}).`);
      if (map.hotspots.length)
        lines.push(
          `Saídas e pontos de interesse: ${map.hotspots.map((h) => h.label).join(', ')}.`,
        );
      if (map.tokens.length)
        lines.push(`Presentes: ${map.tokens.map((t) => t.name).join(', ')}.`);
    }
    if (entries.length) {
      lines.push(
        'Mundo:',
        ...entries.map(
          (entry) =>
            `- ${entry.type.toLowerCase()}: ${entry.name}${entry.summary ? ` - ${entry.summary}` : ''}`,
        ),
      );
    }
    if (journal.length) {
      lines.push(
        `Acontecimentos recentes: ${journal.map((j) => j.title).join('; ')}.`,
      );
    }
    return lines.join('\n');
  }

  private translateError(error: unknown): HttpException {
    if (error instanceof Anthropic.AuthenticationError) {
      return new ServiceUnavailableException(
        'A chave da API do assistente é inválida. Verifique ANTHROPIC_API_KEY no servidor.',
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new HttpException(
        'O assistente está com muitos pedidos agora. Tente de novo em instantes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(
        `Erro da API do assistente: ${error.status} ${error.message}`,
      );
      return new HttpException(
        'O assistente não respondeu. Tente de novo.',
        HttpStatus.BAD_GATEWAY,
      );
    }
    this.logger.error('Falha ao chamar o assistente', error as Error);
    return new HttpException(
      'Não foi possível falar com o assistente.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  private monthStart() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private async assertIsMaster(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Apenas o mestre usa o assistente.');
    }
    return campaign;
  }
}
