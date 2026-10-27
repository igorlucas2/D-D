import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseStringArray } from '../common/json';
import type { AiTurnCharacter, AiTurnContext } from './ai-master.types';

const MAX_CONTEXT_BYTES = 12_000;
const MAX_FACTS = 24;
const MAX_EVENTS = 6;

@Injectable()
export class AiTurnContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    campaignId: string,
    userId: string,
    action: string,
    characterEntityId?: string,
  ): Promise<AiTurnContext> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        name: true,
        masterId: true,
        members: { select: { userId: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');

    const memberIds = [
      campaign.masterId,
      ...campaign.members.map((member) => member.userId),
    ];
    const [lore, scene, calendar, rows, player] = await Promise.all([
      this.prisma.campaignLore.findUnique({ where: { campaignId } }),
      this.prisma.sceneState.findUnique({
        where: { campaignId },
        include: { place: { include: { entity: true } } },
      }),
      this.prisma.campaignCalendar.findUnique({ where: { campaignId } }),
      this.prisma.campaignCharacter.findMany({
        where: {
          campaignId,
          character: { userId: { in: memberIds } },
        },
        include: { character: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      }),
    ]);
    if (!lore)
      throw new ConflictException(
        'Instale um cenário antes de usar o mestre IA.',
      );
    if (!scene)
      throw new ConflictException('A campanha ainda não tem uma cena ativa.');
    if (!calendar)
      throw new ConflictException('A campanha ainda não tem calendário.');

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
    const conditions = new Map<string, string[]>();
    for (const participant of participants) {
      if (!participant.characterId) continue;
      conditions.set(
        participant.characterId,
        parseStringArray(participant.conditions),
      );
    }

    const characters: AiTurnCharacter[] = rows.map((row) => ({
      entityId: row.entityId,
      name: row.character.name,
      hp: {
        current: row.character.currentHp,
        max: row.character.maxHp,
        temp: row.character.tempHp,
      },
      armorClass: row.character.armorClass,
      conditions: conditions.get(row.characterId) ?? [],
    }));

    const facts = await this.prisma.storyFact.findMany({
      where: { campaignId },
      include: {
        revisions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: { audience: true },
        },
      },
      orderBy: { key: 'asc' },
      take: 80,
    });
    const publicFacts = facts
      .filter((fact) => fact.revisions[0]?.audience.scope === 'PUBLIC')
      .slice(0, MAX_FACTS)
      .map((fact) => ({
        text: fact.revisions[0]?.text ?? '',
        classification:
          fact.kind === 'CLAIM' ? ('RUMOR' as const) : fact.classification,
      }))
      .filter((fact) => fact.text.trim());

    const events = await this.prisma.storyEvent.findMany({
      where: { campaignId, audience: { scope: 'PUBLIC' } },
      orderBy: { sequence: 'desc' },
      take: MAX_EVENTS,
      select: { sequence: true, gameMinute: true, summary: true },
    });

    const selectedCharacter = characterEntityId
      ? rows.find((row) => row.entityId === characterEntityId)
      : rows.find((row) => row.character.userId === userId);

    const context: AiTurnContext = {
      campaign: { name: campaign.name },
      scene: {
        name: scene.place.entity.name,
        phase: scene.phase,
        gameMinute: calendar.totalMinutes,
        weather: calendar.weather,
      },
      player: {
        name: player?.displayName ?? 'Jogador',
        character: selectedCharacter?.character.name ?? null,
      },
      characters,
      facts: publicFacts,
      recent: events
        .slice()
        .reverse()
        .map((event) => ({
          sequence: event.sequence,
          gameMinute: event.gameMinute,
          summary: event.summary,
        })),
      action,
      rules: [
        'Narre apenas a consequência imediata da ação.',
        'Não invente fatos, nomes, itens, recompensas, dano, PV, rolagens ou mudanças de tempo e lugar.',
        'Use apenas os fatos públicos listados; não revele segredos.',
        'Se faltar informação essencial, preencha ask e não avance a história.',
        'Não descreva pensamentos íntimos dos personagens dos jogadores.',
      ],
    };

    while (
      Buffer.byteLength(JSON.stringify(context), 'utf8') > MAX_CONTEXT_BYTES &&
      context.recent.length > 0
    ) {
      context.recent.shift();
    }
    if (
      Buffer.byteLength(JSON.stringify(context), 'utf8') > MAX_CONTEXT_BYTES
    ) {
      throw new ConflictException(
        'A cena tem contexto demais para o modelo local. Resuma ou reduza os fatos.',
      );
    }

    return context;
  }
}
