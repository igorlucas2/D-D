import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VttGateway } from '../vtt/vtt.gateway';
import { SendChatDto } from './dto/send-chat.dto';
import { scrambleText } from './language-scramble';

const HISTORY_LIMIT = 60;
const RATE_WINDOW_MS = 5000;
const RATE_MAX_MESSAGES = 6;

const MESSAGE_INCLUDE = {
  author: { select: { id: true, displayName: true } },
  character: { select: { id: true, name: true } },
  language: { select: { id: true, name: true } },
  recipients: { select: { user: { select: { id: true, displayName: true } } } },
} satisfies Prisma.ChatMessageInclude;

type MessageWithRelations = Prisma.ChatMessageGetPayload<{
  include: typeof MESSAGE_INCLUDE;
}>;

/** Mensagem como uma pessoa específica deve recebê-la. */
export interface ProjectedChatMessage {
  id: string;
  kind: MessageWithRelations['kind'];
  content: string;
  /** false: fala em idioma que a pessoa não conhece (texto embaralhado). */
  understood: boolean;
  language: { id: string; name: string } | null;
  author: { id: string; displayName: string };
  character: { id: string; name: string } | null;
  recipients: { id: string; displayName: string }[];
  createdAt: Date;
}

interface Viewer {
  userId: string;
  isMaster: boolean;
  /** Idiomas que algum personagem da pessoa conhece. */
  knownLanguageIds: Set<string>;
}

// Conversa da mesa (MV-08) com idiomas do mundo (IM-11). Cada destinatário
// recebe sua própria projeção: sussurros só para quem foi incluído (e mestre) e
// falas em idioma desconhecido já embaralhadas pelo servidor.
@Injectable()
export class ChatService {
  private readonly recentByUser = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly vttGateway: VttGateway,
  ) {}

  async send(campaignId: string, userId: string, dto: SendChatDto) {
    const campaign = await this.getCampaign(campaignId, userId);
    const isMaster = campaign.masterId === userId;
    this.assertRate(userId);

    const content = dto.content.trim();
    if (!content) throw new BadRequestException('Escreva a mensagem.');

    if (dto.characterId) {
      const character = await this.prisma.character.findUnique({
        where: { id: dto.characterId },
        select: { userId: true },
      });
      if (!character || character.userId !== userId) {
        throw new ForbiddenException('Este personagem não é seu.');
      }
    }

    // Idioma é só de fala (em personagem ou sussurro). Ação é vista por todos e
    // fora do personagem é conversa entre jogadores.
    const spoken = dto.kind === 'IC' || dto.kind === 'WHISPER';
    const languageId = spoken ? (dto.languageId ?? null) : null;
    if (languageId) {
      await this.getLanguage(campaignId, languageId);
      if (!isMaster) {
        if (!dto.characterId) {
          throw new BadRequestException(
            'Escolha qual personagem fala neste idioma.',
          );
        }
        const knows = await this.prisma.characterLanguage.findUnique({
          where: {
            characterId_languageId: {
              characterId: dto.characterId,
              languageId,
            },
          },
        });
        if (!knows) {
          throw new BadRequestException('Seu personagem não fala este idioma.');
        }
      }
    }

    const memberIds = new Set(campaign.members.map((m) => m.userId));
    memberIds.add(campaign.masterId);
    let recipientIds: string[] = [];
    if (dto.kind === 'WHISPER') {
      recipientIds = [...new Set(dto.recipientIds ?? [])].filter(
        (id) => id !== userId,
      );
      if (recipientIds.length === 0) {
        throw new BadRequestException('Escolha para quem sussurrar.');
      }
      if (recipientIds.some((id) => !memberIds.has(id))) {
        throw new BadRequestException('Sussurre só para quem está na mesa.');
      }
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        campaignId,
        authorId: userId,
        characterId: dto.characterId ?? null,
        kind: dto.kind,
        content,
        languageId,
        recipients: { create: recipientIds.map((id) => ({ userId: id })) },
      },
      include: MESSAGE_INCLUDE,
    });

    // Sussurro: autor, destinatários e mestre. Demais: toda a mesa.
    const audience =
      dto.kind === 'WHISPER'
        ? new Set([userId, campaign.masterId, ...recipientIds])
        : memberIds;
    const viewers = await this.buildViewers(
      campaign.masterId,
      [...audience],
      languageId,
    );
    for (const viewer of viewers) {
      this.vttGateway.emitToUser(
        campaignId,
        viewer.userId,
        'table:chat',
        this.project(message, viewer),
      );
    }
    return this.project(
      message,
      viewers.find((viewer) => viewer.userId === userId)!,
    );
  }

  async history(campaignId: string, userId: string) {
    const campaign = await this.getCampaign(campaignId, userId);
    const isMaster = campaign.masterId === userId;
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        campaignId,
        ...(isMaster
          ? {}
          : {
              OR: [
                { kind: { not: 'WHISPER' } },
                { authorId: userId },
                { recipients: { some: { userId } } },
              ],
            }),
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      include: MESSAGE_INCLUDE,
    });
    const [viewer] = await this.buildViewers(campaign.masterId, [userId]);
    return messages.reverse().map((message) => this.project(message, viewer));
  }

  /**
   * Idiomas da campanha e quem fala o quê. O mestre vê os personagens de todos
   * os membros; o jogador, só os próprios.
   */
  async languages(campaignId: string, userId: string) {
    const campaign = await this.getCampaign(campaignId, userId);
    const isMaster = campaign.masterId === userId;
    const ownerIds = isMaster
      ? [
          ...new Set([
            campaign.masterId,
            ...campaign.members.map((m) => m.userId),
          ]),
        ]
      : [userId];
    const [languages, characters] = await Promise.all([
      this.prisma.campaignWorldEntry.findMany({
        where: { campaignId, type: 'IDIOMA' },
        select: { id: true, name: true, summary: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.character.findMany({
        where: { userId: { in: ownerIds } },
        select: {
          id: true,
          name: true,
          user: { select: { id: true, displayName: true } },
          languages: {
            where: { language: { campaignId } },
            select: { languageId: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      languages,
      characters: characters.map(({ languages: known, ...character }) => ({
        ...character,
        languageIds: known.map((item) => item.languageId),
      })),
    };
  }

  async teach(
    campaignId: string,
    userId: string,
    languageId: string,
    characterId: string,
    learn: boolean,
  ) {
    const campaign = await this.getCampaign(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Apenas o mestre ensina idiomas.');
    }
    await this.getLanguage(campaignId, languageId);
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true },
    });
    const memberIds = new Set([
      campaign.masterId,
      ...campaign.members.map((m) => m.userId),
    ]);
    if (!character || !memberIds.has(character.userId)) {
      throw new NotFoundException('Personagem não encontrado nesta mesa.');
    }
    if (learn) {
      await this.prisma.characterLanguage.upsert({
        where: { characterId_languageId: { characterId, languageId } },
        create: { characterId, languageId },
        update: {},
      });
    } else {
      await this.prisma.characterLanguage.deleteMany({
        where: { characterId, languageId },
      });
    }
    return this.languages(campaignId, userId);
  }

  private project(
    message: MessageWithRelations,
    viewer: Viewer,
  ): ProjectedChatMessage {
    const understood =
      !message.languageId ||
      viewer.isMaster ||
      message.authorId === viewer.userId ||
      viewer.knownLanguageIds.has(message.languageId);
    return {
      id: message.id,
      kind: message.kind,
      content: understood
        ? message.content
        : scrambleText(message.content, message.languageId!),
      understood,
      language: message.language,
      author: message.author,
      character: message.character,
      recipients: message.recipients.map((item) => item.user),
      createdAt: message.createdAt,
    };
  }

  private async buildViewers(
    masterId: string,
    userIds: string[],
    onlyLanguageId?: string | null,
  ): Promise<Viewer[]> {
    const known =
      onlyLanguageId === null
        ? []
        : await this.prisma.characterLanguage.findMany({
            where: {
              character: { userId: { in: userIds } },
              ...(onlyLanguageId ? { languageId: onlyLanguageId } : {}),
            },
            select: {
              languageId: true,
              character: { select: { userId: true } },
            },
          });
    return userIds.map((id) => ({
      userId: id,
      isMaster: id === masterId,
      knownLanguageIds: new Set(
        known
          .filter((item) => item.character.userId === id)
          .map((item) => item.languageId),
      ),
    }));
  }

  private assertRate(userId: string) {
    const now = Date.now();
    const recent = (this.recentByUser.get(userId) ?? []).filter(
      (time) => now - time < RATE_WINDOW_MS,
    );
    if (recent.length >= RATE_MAX_MESSAGES) {
      throw new HttpException(
        'Muitas mensagens seguidas. Espere um instante.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.recentByUser.set(userId, recent);
  }

  private async getLanguage(campaignId: string, languageId: string) {
    const language = await this.prisma.campaignWorldEntry.findUnique({
      where: { id: languageId },
      select: { campaignId: true, type: true },
    });
    if (
      !language ||
      language.campaignId !== campaignId ||
      language.type !== 'IDIOMA'
    ) {
      throw new NotFoundException('Idioma não encontrado nesta campanha.');
    }
    return language;
  }

  private async getCampaign(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    const isMember =
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Você não tem acesso a esta campanha.');
    }
    return campaign;
  }
}
