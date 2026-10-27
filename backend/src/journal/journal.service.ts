import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorldService } from '../world/world.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

const RETURN_SUMMARY_LIMIT = 8;

const AUTHOR_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worldService: WorldService,
  ) {}

  /**
   * Entradas restritas (revelações) só aparecem para o autor, o mestre e os
   * destinatários. A lista de destinatários só é enviada ao mestre.
   */
  async findAll(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    const isMaster = campaign.masterId === userId;

    const entries = await this.prisma.campaignJournalEntry.findMany({
      where: { campaignId, ...this.visibleTo(isMaster, userId) },
      include: {
        author: { select: AUTHOR_SELECT },
        recipients: {
          select: { user: { select: { id: true, displayName: true } } },
        },
      },
      orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
    });

    return entries.map(({ recipients, ...entry }) => ({
      ...entry,
      recipients: isMaster ? recipients.map((item) => item.user) : [],
    }));
  }

  /**
   * Resumo de retorno (IM-10): o que entrou no diário desde a última visita,
   * com as mesmas regras de visibilidade, e quanto tempo passou no mundo.
   * Não marca a visita; isso é feito por `markVisit`.
   */
  async sinceLastVisit(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    // O calendário do mundo tem valor padrão mesmo antes de ser salvo.
    const [member, calendar] = await Promise.all([
      this.prisma.campaignMember.findUnique({
        where: { campaignId_userId: { campaignId, userId } },
      }),
      this.worldService.getCalendar(campaignId, userId),
    ]);
    if (!member?.lastSeenAt) return { firstVisit: true as const };

    const where: Prisma.CampaignJournalEntryWhereInput = {
      campaignId,
      createdAt: { gt: member.lastSeenAt },
      authorId: { not: userId },
      ...this.visibleTo(campaign.masterId === userId, userId),
    };
    const [total, entries] = await Promise.all([
      this.prisma.campaignJournalEntry.count({ where }),
      this.prisma.campaignJournalEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: RETURN_SUMMARY_LIMIT,
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          restricted: true,
          createdAt: true,
        },
      }),
    ]);

    const gameMinutesElapsed =
      member.lastSeenGameMinutes !== null
        ? Math.max(0, calendar.totalMinutes - member.lastSeenGameMinutes)
        : null;

    return {
      firstVisit: false as const,
      lastSeenAt: member.lastSeenAt,
      gameMinutesElapsed,
      weather: calendar.weather,
      totalNew: total,
      entries: entries.map(({ content, ...entry }) => ({
        ...entry,
        excerpt: content.length > 180 ? `${content.slice(0, 177)}...` : content,
      })),
    };
  }

  /** Registra que a pessoa está na mesa agora (abertura e batidas periódicas). */
  async markVisit(campaignId: string, userId: string) {
    await this.assertIsMember(campaignId, userId);
    const calendar = await this.worldService.getCalendar(campaignId, userId);
    await this.prisma.campaignMember.updateMany({
      where: { campaignId, userId },
      data: {
        lastSeenAt: new Date(),
        lastSeenGameMinutes: calendar.totalMinutes,
      },
    });
    return { success: true };
  }

  async create(campaignId: string, userId: string, dto: CreateJournalEntryDto) {
    await this.assertIsMember(campaignId, userId);

    return this.prisma.campaignJournalEntry.create({
      data: {
        campaignId,
        authorId: userId,
        title: dto.title,
        content: dto.content,
        category: dto.category,
        sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : null,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async update(
    campaignId: string,
    entryId: string,
    userId: string,
    dto: UpdateJournalEntryDto,
  ) {
    const entry = await this.getOwnedEntry(campaignId, entryId, userId);

    return this.prisma.campaignJournalEntry.update({
      where: { id: entry.id },
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        sessionDate:
          dto.sessionDate !== undefined ? new Date(dto.sessionDate) : undefined,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async remove(campaignId: string, entryId: string, userId: string) {
    await this.getOwnedEntry(campaignId, entryId, userId);
    await this.prisma.campaignJournalEntry.delete({ where: { id: entryId } });
    return { success: true };
  }

  /** Revelações restritas só aparecem para autor, mestre e destinatários. */
  private visibleTo(
    isMaster: boolean,
    userId: string,
  ): Prisma.CampaignJournalEntryWhereInput {
    if (isMaster) return {};
    return {
      OR: [
        { restricted: false },
        { authorId: userId },
        { recipients: { some: { userId } } },
      ],
    };
  }

  private async getOwnedEntry(
    campaignId: string,
    entryId: string,
    userId: string,
  ) {
    const campaign = await this.assertIsMember(campaignId, userId);

    const entry = await this.prisma.campaignJournalEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry || entry.campaignId !== campaignId) {
      throw new NotFoundException('Entrada não encontrada.');
    }

    if (entry.authorId !== userId && campaign.masterId !== userId) {
      throw new ForbiddenException(
        'Apenas o autor ou o mestre podem alterar esta entrada.',
      );
    }

    return entry;
  }

  private async assertIsMember(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    const isMember =
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Você não tem acesso a esta campanha.');
    }

    return campaign;
  }
}
