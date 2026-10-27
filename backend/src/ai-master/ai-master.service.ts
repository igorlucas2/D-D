import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CampaignAccessService } from '../campaigns/campaign-access.service';
import { parseStringArray } from '../common/json';
import { parseItemEffect } from '../combat/item-use.types';
import { PrismaService } from '../prisma/prisma.service';
import { StoryService } from '../story/story.service';
import { AiTurnContextBuilder } from './ai-master.context';
import type { AiTurnState } from './ai-master.types';
import {
  AiProviderError,
  LocalAiProvider,
  type AiTurnGeneration,
} from './local-ai.provider';
import { AiTurnValidationError, type AiTurnResult } from './turn.schema';

const MODES = ['OFF', 'COPILOT', 'AUTONOMOUS'] as const;
type Mode = (typeof MODES)[number];

function modeOf(value: string): Mode {
  return (MODES as readonly string[]).includes(value) ? (value as Mode) : 'OFF';
}

function parsePayload(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function textField(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

@Injectable()
export class AiMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly story: StoryService,
    private readonly context: AiTurnContextBuilder,
    private readonly provider: LocalAiProvider,
  ) {}

  async state(campaignId: string, userId: string): Promise<AiTurnState> {
    const campaign = await this.access.member(campaignId, userId);
    const lore = await this.prisma.campaignLore.findUnique({
      where: { campaignId },
      select: {
        mode: true,
        aiPaused: true,
        revision: true,
        storySequence: true,
      },
    });
    if (!lore)
      throw new ConflictException(
        'Instale um cenário antes de usar o mestre IA.',
      );

    const [scene, calendar, rows, events, provider] = await Promise.all([
      this.prisma.sceneState.findUnique({
        where: { campaignId },
        include: { place: { include: { entity: true } } },
      }),
      this.prisma.campaignCalendar.findUnique({ where: { campaignId } }),
      this.prisma.campaignCharacter.findMany({
        where: { campaignId },
        include: {
          character: {
            include: {
              inventory: { include: { item: true }, orderBy: { id: 'asc' } },
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.storyEvent.findMany({
        where: { campaignId, audience: { scope: 'PUBLIC' } },
        orderBy: { sequence: 'desc' },
        take: 8,
        select: {
          id: true,
          sequence: true,
          gameMinute: true,
          summary: true,
          payload: true,
        },
      }),
      this.provider.status(),
    ]);

    const characterIds = rows.map((row) => row.characterId);
    const participants =
      characterIds.length === 0
        ? []
        : await this.prisma.combatParticipant.findMany({
            where: {
              characterId: { in: characterIds },
              encounter: { campaignId },
            },
            select: { characterId: true, conditions: true },
          });
    const conditionsByCharacter = new Map<string, string[]>();
    for (const participant of participants) {
      if (participant.characterId) {
        conditionsByCharacter.set(
          participant.characterId,
          parseStringArray(participant.conditions),
        );
      }
    }

    return {
      mode: modeOf(lore.mode),
      paused: lore.aiPaused,
      revision: lore.revision,
      isMaster: campaign.masterId === userId,
      storyReady: lore.storySequence > 0,
      scene:
        scene && calendar
          ? {
              name: scene.place.entity.name,
              phase: scene.phase,
              gameMinute: calendar.totalMinutes,
              weather: calendar.weather,
            }
          : null,
      characters: rows.map((row) => ({
        id: row.entityId,
        characterId: row.characterId,
        name: row.character.name,
        isMine: row.character.userId === userId,
        currentHp: row.character.currentHp,
        maxHp: row.character.maxHp,
        tempHp: row.character.tempHp,
        armorClass: row.character.armorClass,
        conditions: conditionsByCharacter.get(row.characterId) ?? [],
        items: row.character.inventory.map((entry) => ({
          inventoryItemId: entry.id,
          itemId: entry.itemId,
          name: entry.item.name,
          quantity: entry.quantity,
          category: entry.item.category,
          properties: entry.item.properties,
          description: entry.item.description,
          effectKind: parseItemEffect(entry.item.properties)?.kind ?? null,
        })),
      })),
      events: events.map((event) => ({
        eventId: event.id,
        sequence: event.sequence,
        gameMinute: event.gameMinute,
        summary: event.summary,
        narration: textField(parsePayload(event.payload)?.narration),
      })),
      provider,
    };
  }

  async settings(
    campaignId: string,
    userId: string,
    input: { mode: Mode; paused: boolean; expectedRevision: number },
  ) {
    await this.access.master(campaignId, userId);
    if (!MODES.includes(input.mode)) {
      throw new BadRequestException('Modo de mestre IA inválido.');
    }
    const lore = await this.prisma.campaignLore.findUnique({
      where: { campaignId },
      select: { storySequence: true },
    });
    if (!lore)
      throw new ConflictException(
        'Instale um cenário antes de usar o mestre IA.',
      );
    if (lore.storySequence < 1 && input.mode === 'AUTONOMOUS') {
      throw new ConflictException(
        'Inicie a memória do cenário antes de ligar o mestre IA.',
      );
    }

    const updated = await this.prisma.campaignLore.updateMany({
      where: { campaignId, revision: input.expectedRevision },
      data: {
        mode: input.mode,
        aiPaused: input.paused,
        revision: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'A campanha mudou. Atualize antes de alterar o mestre IA.',
      );
    }
    return { mode: input.mode, paused: input.paused };
  }

  async act(
    campaignId: string,
    userId: string,
    input: {
      requestKey: string;
      action: string;
      characterId?: string;
      expectedRevision: number;
    },
  ) {
    const campaign = await this.access.member(campaignId, userId);
    const lore = await this.prisma.campaignLore.findUnique({
      where: { campaignId },
      select: {
        mode: true,
        aiPaused: true,
        revision: true,
        storySequence: true,
      },
    });
    if (!lore)
      throw new ConflictException(
        'Instale um cenário antes de usar o mestre IA.',
      );
    if (lore.storySequence < 1) {
      throw new ConflictException(
        'Inicie a memória do cenário antes de jogar com o mestre IA.',
      );
    }
    if (modeOf(lore.mode) !== 'AUTONOMOUS') {
      throw new ConflictException('Ligue o mestre IA autônomo para jogar.');
    }
    if (lore.aiPaused) {
      throw new ConflictException('O mestre IA está pausado.');
    }
    if (lore.revision !== input.expectedRevision) {
      throw new ConflictException('A cena mudou. Atualize antes de agir.');
    }

    const existing = await this.prisma.storyEvent.findUnique({
      where: {
        campaignId_requestKey: { campaignId, requestKey: input.requestKey },
      },
      select: { id: true, sequence: true, gameMinute: true, payload: true },
    });
    if (existing) return this.replay(existing);

    const action = input.action.trim();
    if (!action) throw new BadRequestException('Descreva sua ação.');

    const requested = input.characterId
      ? await this.prisma.campaignCharacter.findFirst({
          where: {
            campaignId,
            entityId: input.characterId,
            character: { userId },
          },
          include: { character: true },
        })
      : await this.prisma.campaignCharacter.findFirst({
          where: { campaignId, character: { userId } },
          include: { character: true },
          orderBy: { joinedAt: 'asc' },
        });
    if (input.characterId && !requested) {
      throw new BadRequestException(
        'Escolha um personagem seu nesta campanha.',
      );
    }
    if (!requested && campaign.masterId !== userId) {
      throw new BadRequestException(
        'Crie ou escolha um personagem para agir nesta campanha.',
      );
    }

    const context = await this.context.build(
      campaignId,
      userId,
      action,
      requested?.entityId,
    );

    let generation: AiTurnGeneration;
    try {
      generation = await this.provider.narrate(context);
    } catch (error) {
      if (error instanceof AiTurnValidationError) {
        try {
          generation = await this.provider.narrate(context, error.issues);
        } catch (second) {
          throw this.outputError(second);
        }
      } else {
        throw this.outputError(error);
      }
    }

    const result: AiTurnResult = generation.result;
    const payload = {
      schemaVersion: 1,
      action,
      characterId: requested?.entityId ?? null,
      narration: result.narration,
      memory: result.memory,
      ask: result.ask,
      model: generation.model,
      latencyMs: generation.latencyMs,
      inputTokens: generation.inputTokens,
      outputTokens: generation.outputTokens,
    };

    if (result.ask) {
      return {
        eventId: null,
        sequence: null,
        gameMinute: null,
        narration: result.narration,
        memory: result.memory,
        ask: result.ask,
        model: generation.model,
        latencyMs: generation.latencyMs,
        alreadyApplied: false,
        persisted: false,
      };
    }

    try {
      const event = await this.story.appendAiTurn(campaignId, {
        requestKey: input.requestKey,
        summary: result.memory.summary,
        payload,
      });
      return {
        ...event,
        narration: result.narration,
        memory: result.memory,
        ask: null,
        model: generation.model,
        latencyMs: generation.latencyMs,
        alreadyApplied: false,
        persisted: true,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.storyEvent.findUnique({
          where: {
            campaignId_requestKey: { campaignId, requestKey: input.requestKey },
          },
          select: {
            id: true,
            sequence: true,
            gameMinute: true,
            payload: true,
          },
        });
        if (replay) return this.replay(replay);
      }
      throw error;
    }
  }

  private replay(event: {
    id: string;
    sequence: number;
    gameMinute: number;
    payload: string;
  }) {
    const payload = parsePayload(event.payload);
    return {
      eventId: event.id,
      sequence: event.sequence,
      gameMinute: event.gameMinute,
      narration: textField(payload?.narration) ?? '',
      memory: payload?.memory ?? null,
      ask: textField(payload?.ask),
      model: textField(payload?.model),
      latencyMs:
        typeof payload?.latencyMs === 'number' ? payload.latencyMs : null,
      alreadyApplied: true,
      persisted: true,
    };
  }

  private outputError(error: unknown) {
    if (error instanceof AiTurnValidationError) {
      return new UnprocessableEntityException({
        message:
          'O mestre IA não conseguiu produzir uma narração válida. Tente de novo.',
        issues: error.issues,
        fallback:
          'O mestre local não respondeu dentro das regras. A cena continua como está; tente novamente ou resolva a ação manualmente.',
      });
    }
    if (
      error instanceof AiProviderError &&
      [
        'PROVIDER_UNAVAILABLE',
        'MODEL_NOT_INSTALLED',
        'LOCAL_PROVIDER_REQUIRED',
      ].includes(error.code)
    ) {
      return new ServiceUnavailableException(
        'Mestre IA local indisponível. Verifique o Ollama e o modelo configurado.',
      );
    }
    return new UnprocessableEntityException(
      'O mestre IA devolveu uma resposta inválida. Tente de novo.',
    );
  }
}
