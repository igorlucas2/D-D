import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type GameMasterTurn } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { canonical } from '../game-actions/game-action.types';
import { StoryService } from '../story/story.service';
import { GameMasterContext, type CopilotContext } from './game-master.context';
import { intentIsCurrent } from './intent-access';
import { parseProposal } from './proposal';

type Tx = Prisma.TransactionClient;
const activeStatuses = [
  'REQUESTED',
  'GENERATING',
  'READY',
  'FAILED',
  'STALE',
  'WAITING_PLAYER',
] as const;
export interface IntentInput {
  requestKey: string;
  playerEntityId: string;
  focusEntityId?: string;
  parentTurnId?: string;
  prompt: string;
  expectedSceneRevision: number;
}
export interface IntentReply {
  text: string;
  kind: 'ANSWER' | 'ASK';
  source: 'DRAFT' | 'MANUAL';
  expectedRevision: number;
}

@Injectable()
export class PlayerIntentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly context: GameMasterContext,
    private readonly story: StoryService,
  ) {}

  private async access(tx: Tx, id: string, userId: string) {
    const campaign = await tx.campaign.findUnique({
      where: { id },
      include: { lore: true, members: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (
      campaign.masterId !== userId &&
      !campaign.members.some((m) => m.userId === userId)
    )
      throw new ForbiddenException('Você não participa desta mesa.');
    if (!campaign.lore?.domainVersion)
      throw new ConflictException(
        'Prepare o cenário e seus comandos primeiro.',
      );
    return {
      campaign,
      lore: campaign.lore,
      master: campaign.masterId === userId,
    };
  }
  private async write<T>(
    id: string,
    userId: string,
    fn: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    for (let n = 0; ; n++)
      try {
        return await this.db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${id} FOR UPDATE`;
            await this.access(tx, id, userId);
            return fn(tx);
          },
          { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2034' &&
          n < 2
        )
          continue;
        throw e;
      }
  }

  async state(id: string, userId: string) {
    return this.db.$transaction(
      async (tx) => {
        const { campaign, lore, master } = await this.access(tx, id, userId);
        const scene = await tx.sceneState.findUniqueOrThrow({
          where: { campaignId: id },
          include: { place: { include: { entity: true } } },
        });
        const characters = await tx.campaignCharacter.findMany({
          where: { campaignId: id, character: { userId } },
          include: { character: true },
        });
        const npcs = await tx.campaignNpc.findMany({
          where: {
            campaignId: id,
            placeEntityId: scene.placeEntityId,
            activeJourneyId: null,
          },
          include: { entity: true },
          orderBy: { entity: { name: 'asc' } },
        });
        const where: Prisma.GameMasterTurnWhereInput = {
          campaignId: id,
          playerEntityId: { not: null },
          ...(!master ? { requestedById: userId } : {}),
        };
        // Active conversations remain visible even when the history grows.
        const include = { playerEntity: true, focus: true } as const;
        const pending = await tx.gameMasterTurn.findMany({
          where: { ...where, status: { in: [...activeStatuses] } },
          include,
          orderBy: { createdAt: 'asc' },
        });
        const recent = await tx.gameMasterTurn.findMany({
          where: { ...where, status: { notIn: [...activeStatuses] } },
          include,
          orderBy: { createdAt: 'desc' },
          take: 30,
        });
        const turns = await Promise.all(
          [...pending, ...recent].map(async (t) => {
            const current = await intentIsCurrent(tx, t);
            const shared = {
              id: t.id,
              parentTurnId: t.parentTurnId,
              playerEntityId: t.playerEntityId,
              character: t.playerEntity!.name,
              npc: t.focus?.name ?? null,
              focusEntityId: t.focusEntityId,
              prompt: t.prompt,
              status: t.status,
              reply: t.reviewedText,
              replyKind: t.replyKind,
              createdAt: t.createdAt,
              current,
              mine: t.requestedById === userId,
              canReply:
                current &&
                t.status === 'WAITING_PLAYER' &&
                t.requestedById === userId,
              canCancel: t.status !== 'COMMITTED' && t.status !== 'CANCELLED',
            };
            if (master) {
              const proposal = t.proposal ? parseProposal(t.proposal) : null;
              return {
                ...shared,
                proposal,
                errorCode: t.errorCode,
                draftCurrent:
                  current &&
                  t.status === 'READY' &&
                  t.expectedRevision === lore.revision &&
                  t.epoch === lore.aiEpoch &&
                  lore.mode === 'COPILOT' &&
                  !lore.aiPaused,
                sources: proposal
                  ? (JSON.parse(t.context) as CopilotContext).sources.filter(
                      (s) => proposal.evidenceIds.includes(s.id),
                    )
                  : [],
              };
            } else {
              // No snapshot, evidence, provider diagnostics, private revisions or unreviewed text.
              return {
                ...shared,
                status: [
                  'REQUESTED',
                  'GENERATING',
                  'READY',
                  'FAILED',
                  'STALE',
                ].includes(t.status)
                  ? 'WAITING_MASTER'
                  : t.status,
              };
            }
          }),
        );
        return {
          master,
          scene: { name: scene.place.entity.name, revision: scene.revision },
          characters: characters.map((c) => ({
            id: c.entityId,
            name: c.character.name,
          })),
          npcs: npcs.map((n) => ({ id: n.entityId, name: n.entity.name })),
          turns,
          ...(master
            ? {
                revision: lore.revision,
                mode: lore.mode,
                paused: lore.aiPaused,
                masterId: campaign.masterId,
              }
            : {}),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async submit(id: string, userId: string, input: IntentInput) {
    const normalized = {
      ...input,
      prompt: input.prompt.trim(),
      focusEntityId: input.focusEntityId || null,
      parentTurnId: input.parentTurnId || null,
    };
    const hash = createHash('sha256')
      .update(canonical(normalized))
      .digest('hex');
    return this.write(id, userId, async (tx) => {
      const { lore } = await this.access(tx, id, userId);
      const replay = await tx.gameMasterTurn.findUnique({
        where: {
          campaignId_requestKey: {
            campaignId: id,
            requestKey: input.requestKey,
          },
        },
      });
      if (replay) {
        if (
          replay.requestedById !== userId ||
          !replay.playerEntityId ||
          replay.requestHash !== hash
        )
          throw new ConflictException('Chave já usada com outros dados.');
        return { id: replay.id, alreadyRequested: true };
      }
      if (
        !(await intentIsCurrent(tx, {
          campaignId: id,
          requestedById: userId,
          playerEntityId: input.playerEntityId,
          focusEntityId: normalized.focusEntityId,
          sceneRevision: input.expectedSceneRevision,
        }))
      )
        throw new ConflictException(
          'Confira seu personagem, o NPC presente e a cena atual.',
        );
      let parent: GameMasterTurn | null = null;
      if (normalized.parentTurnId) {
        parent = await tx.gameMasterTurn.findFirst({
          where: {
            id: normalized.parentTurnId,
            campaignId: id,
            requestedById: userId,
            playerEntityId: input.playerEntityId,
          },
        });
        if (
          !parent ||
          parent.status !== 'WAITING_PLAYER' ||
          parent.focusEntityId !== normalized.focusEntityId ||
          parent.sceneRevision !== input.expectedSceneRevision
        )
          throw new ConflictException(
            'Esta pergunta não aguarda sua resposta nesta cena.',
          );
      }
      const pending = await tx.gameMasterTurn.count({
        where: {
          campaignId: id,
          playerEntityId: input.playerEntityId,
          status: { in: [...activeStatuses] },
          ...(parent ? { id: { not: parent.id } } : {}),
        },
      });
      if (pending)
        throw new ConflictException(
          'Responda ou cancele a intenção pendente deste personagem primeiro.',
        );
      if (
        (await tx.gameMasterTurn.count({
          where: {
            campaignId: id,
            requestedById: userId,
            playerEntityId: { not: null },
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) >= 30
      )
        throw new ConflictException(
          'Limite de 30 intenções nas últimas 24 horas atingido.',
        );
      const canGenerate =
        lore.mode === 'COPILOT' &&
        !lore.aiPaused &&
        (await tx.gameMasterTurn.count({
          where: {
            campaignId: id,
            status: { in: ['REQUESTED', 'GENERATING', 'READY'] },
          },
        })) < 3 &&
        (await tx.gameMasterTurn.count({
          where: {
            campaignId: id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) < 120;
      const kind = normalized.focusEntityId ? 'NPC' : 'PUBLIC';
      const snapshot = await this.context.build(
        tx,
        id,
        kind,
        normalized.prompt,
        normalized.focusEntityId ?? undefined,
      );
      // Only this conversation's approved replies enter short-term context. Full history stays in MySQL.
      const conversation: { player: string; reply: string }[] = [];
      let cursor = parent;
      for (let n = 0; cursor && n < 3; n++) {
        if (cursor.reviewedText)
          conversation.unshift({
            player: cursor.prompt,
            reply: cursor.reviewedText,
          });
        cursor = cursor.parentTurnId
          ? await tx.gameMasterTurn.findUnique({
              where: { id: cursor.parentTurnId },
            })
          : null;
      }
      snapshot.conversation = conversation;
      snapshot.conversationOmitted = !!cursor;
      while (
        Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 10000 &&
        conversation.length
      ) {
        conversation.shift();
        snapshot.conversationOmitted = true;
      }
      if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 10000)
        throw new ConflictException(
          'Contexto excede o limite local. Reduza o pedido.',
        );
      if (parent)
        await tx.gameMasterTurn.update({
          where: { id: parent.id },
          data: { status: 'COMMITTED' },
        });
      const turn = await tx.gameMasterTurn.create({
        data: {
          campaignId: id,
          requestedById: userId,
          requestKey: input.requestKey,
          requestHash: hash,
          playerEntityId: input.playerEntityId,
          parentTurnId: normalized.parentTurnId,
          focusEntityId: normalized.focusEntityId,
          kind,
          prompt: normalized.prompt,
          expectedRevision: lore.revision,
          sceneRevision: snapshot.sceneRevision,
          epoch: lore.aiEpoch,
          context: JSON.stringify(snapshot),
          status: canGenerate ? 'REQUESTED' : 'FAILED',
          errorCode: canGenerate ? null : 'MANUAL_REVIEW',
        },
      });
      return { id: turn.id, alreadyRequested: false };
    });
  }

  async respond(
    id: string,
    userId: string,
    turnId: string,
    input: IntentReply,
  ) {
    return this.write(id, userId, async (tx) => {
      const { lore, master } = await this.access(tx, id, userId);
      if (!master)
        throw new ForbiddenException('Somente o mestre revisa respostas.');
      const turn = await tx.gameMasterTurn.findFirst({
        where: { id: turnId, campaignId: id, playerEntityId: { not: null } },
      });
      if (!turn) throw new NotFoundException('Intenção não encontrada.');
      const text = input.text.trim();
      if (turn.resultEventId) {
        if (turn.reviewedText !== text || turn.replyKind !== input.kind)
          throw new ConflictException(
            'Esta intenção já recebeu outra resposta.',
          );
        return { eventId: turn.resultEventId, alreadyApplied: true };
      }
      if (turn.status === 'CANCELLED')
        throw new ConflictException('Intenção cancelada.');
      if (lore.revision !== input.expectedRevision)
        throw new ConflictException(
          'A campanha mudou. Atualize antes de responder.',
        );
      if (!(await intentIsCurrent(tx, turn)))
        throw new ConflictException(
          'Personagem, participação ou cena mudaram. Cancele esta intenção.',
        );
      if (input.source === 'DRAFT') {
        if (
          turn.status !== 'READY' ||
          !turn.proposal ||
          lore.mode !== 'COPILOT' ||
          lore.aiPaused ||
          lore.aiEpoch !== turn.epoch ||
          lore.revision !== turn.expectedRevision
        )
          throw new ConflictException(
            'O rascunho mudou ou ficou desatualizado. Revise o estado atual e responda manualmente.',
          );
        const proposal = parseProposal(turn.proposal);
        this.context.validate(
          JSON.parse(turn.context) as CopilotContext,
          proposal,
        );
        this.context.validate(
          await this.context.build(
            tx,
            id,
            turn.kind as 'NPC' | 'PUBLIC',
            turn.prompt,
            turn.focusEntityId ?? undefined,
          ),
          proposal,
        );
      }
      const event = await this.story.command(
        id,
        userId,
        {
          requestKey: turn.id,
          expectedRevision: lore.revision,
          operation: {
            kind: 'NOTE',
            text,
            entityIds: [
              turn.playerEntityId!,
              ...(turn.focusEntityId ? [turn.focusEntityId] : []),
            ],
            audience: {
              scope: 'RECIPIENTS',
              recipientIds: [turn.requestedById],
            },
          },
        },
        tx,
      );
      await tx.gameMasterTurn.update({
        where: { id: turn.id },
        data: {
          status: input.kind === 'ASK' ? 'WAITING_PLAYER' : 'COMMITTED',
          reviewedText: text,
          replyKind: input.kind,
          resultEventId: event.eventId,
          resolvedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return { eventId: event.eventId, alreadyApplied: false };
    });
  }

  async cancel(id: string, userId: string, turnId: string) {
    return this.write(id, userId, async (tx) => {
      const { master } = await this.access(tx, id, userId);
      const turn = await tx.gameMasterTurn.findFirst({
        where: {
          id: turnId,
          campaignId: id,
          playerEntityId: { not: null },
          ...(!master ? { requestedById: userId } : {}),
        },
      });
      if (!turn) throw new NotFoundException('Intenção não encontrada.');
      if (turn.status === 'COMMITTED')
        throw new ConflictException('Esta intenção já foi respondida.');
      await tx.gameMasterTurn.update({
        where: { id: turn.id },
        data: {
          status: 'CANCELLED',
          resolvedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return { id: turn.id, alreadyCancelled: turn.status === 'CANCELLED' };
    });
  }
}
