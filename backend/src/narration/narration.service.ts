import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VttGateway } from '../vtt/vtt.gateway';
import { SaveNarrationDraftDto, SendNarrationDto } from './dto/narration.dto';

// Narração em pergaminho (IM-06): o mestre envia um texto para toda a mesa ou
// para jogadores escolhidos. O destinatário é decidido aqui; quem não recebeu
// não acessa o texto por socket nem pelo diário.
@Injectable()
export class NarrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vttGateway: VttGateway,
  ) {}

  async send(campaignId: string, userId: string, dto: SendNarrationDto) {
    const campaign = await this.assertIsMaster(campaignId, userId);
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('Escreva a narração.');
    const title = dto.title?.trim() || null;

    const recipientIds = [...new Set(dto.recipientIds ?? [])];
    // Só jogadores: o mestre já recebe toda narração.
    const players = new Map(
      campaign.members
        .filter((member) => member.userId !== campaign.masterId)
        .map((member) => [member.userId, member.user]),
    );
    const invalid = recipientIds.filter((id) => !players.has(id));
    if (invalid.length) {
      throw new BadRequestException('Escolha apenas jogadores desta campanha.');
    }
    const restricted = recipientIds.length > 0;

    let journalEntryId: string | null = null;
    if (dto.recordInJournal) {
      const entry = await this.prisma.campaignJournalEntry.create({
        data: {
          campaignId,
          authorId: userId,
          title: title ?? 'Narração',
          content,
          category: 'EVENTO',
          restricted,
          recipients: {
            create: recipientIds.map((id) => ({ userId: id })),
          },
        },
      });
      journalEntryId = entry.id;
    }

    const narration = {
      id: randomUUID(),
      title,
      content,
      from: campaign.master.displayName,
      restricted,
      journalEntryId,
      sentAt: new Date().toISOString(),
    };
    this.vttGateway.emitNarration(
      campaignId,
      narration,
      restricted ? recipientIds : null,
    );

    return {
      ...narration,
      recipients: recipientIds.map((id) => ({
        id,
        displayName: players.get(id)!.displayName,
      })),
    };
  }

  async listDrafts(campaignId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    return this.prisma.narrationDraft.findMany({
      where: { campaignId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createDraft(
    campaignId: string,
    userId: string,
    dto: SaveNarrationDraftDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    const mapId = await this.validMapId(campaignId, dto.mapId);
    return this.prisma.narrationDraft.create({
      data: {
        campaignId,
        mapId,
        title: dto.title.trim(),
        content: dto.content.trim(),
      },
    });
  }

  async updateDraft(
    campaignId: string,
    draftId: string,
    userId: string,
    dto: SaveNarrationDraftDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedDraft(campaignId, draftId);
    const mapId = await this.validMapId(campaignId, dto.mapId);
    return this.prisma.narrationDraft.update({
      where: { id: draftId },
      data: { mapId, title: dto.title.trim(), content: dto.content.trim() },
    });
  }

  async removeDraft(campaignId: string, draftId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedDraft(campaignId, draftId);
    await this.prisma.narrationDraft.delete({ where: { id: draftId } });
    return { success: true };
  }

  /**
   * Chamado após uma viagem: se houver narração preparada para o destino,
   * sugere ao mestre lê-la. Só o mestre recebe a sugestão.
   */
  async suggestOnArrival(
    campaignId: string,
    mapId: string,
    characterName: string,
  ) {
    const drafts = await this.prisma.narrationDraft.findMany({
      where: { campaignId, mapId },
      include: { map: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    if (!drafts.length) return;
    this.vttGateway.emitToMaster(campaignId, 'table:narration:suggestion', {
      characterName,
      mapName: drafts[0].map?.name ?? '',
      drafts: drafts.map(({ id, title }) => ({ id, title })),
    });
  }

  private async validMapId(campaignId: string, mapId?: string | null) {
    if (!mapId) return null;
    const map = await this.prisma.vttMap.findUnique({
      where: { id: mapId },
      select: { campaignId: true },
    });
    if (!map || map.campaignId !== campaignId) {
      throw new NotFoundException('Mapa não encontrado.');
    }
    return mapId;
  }

  private async getOwnedDraft(campaignId: string, draftId: string) {
    const draft = await this.prisma.narrationDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft || draft.campaignId !== campaignId) {
      throw new NotFoundException('Rascunho não encontrado.');
    }
    return draft;
  }

  private async assertIsMaster(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        master: { select: { displayName: true } },
        members: {
          select: {
            userId: true,
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Apenas o mestre pode narrar.');
    }
    return campaign;
  }
}
