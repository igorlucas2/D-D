import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GameActionsService } from '../game-actions/game-actions.service';
import { canonical } from '../game-actions/game-action.types';
import { StoryService } from '../story/story.service';
import { GameMasterProvider, type ModelResult } from './ollama.provider';
import { GameMasterContext, type CopilotContext } from './game-master.context';
import { parseProposal, type Proposal, type TurnKind } from './proposal';
import { intentIsCurrent } from './intent-access';
type Tx = Prisma.TransactionClient;
@Injectable()
export class GameMasterService {
  private running = false;
  constructor(
    private readonly db: PrismaService,
    private readonly context: GameMasterContext,
    private readonly provider: GameMasterProvider,
    private readonly game: GameActionsService,
    private readonly story: StoryService,
  ) {}
  private async access(tx: Tx, id: string, userId: string) {
    const campaign = await tx.campaign.findUnique({
      where: { id },
      include: { lore: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.masterId !== userId)
      throw new ForbiddenException('O copiloto é reservado ao mestre.');
    if (!campaign.lore?.domainVersion)
      throw new ConflictException(
        'Prepare o cenário e seus comandos primeiro.',
      );
    return campaign.lore;
  }
  private async write<T>(
    id: string,
    userId: string,
    fn: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
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
          attempt < 2
        )
          continue;
        throw e;
      }
  }
  async state(id: string, userId: string) {
    const data = await this.db.$transaction(
      async (tx) => {
        const lore = await this.access(tx, id, userId);
        const scene = await tx.sceneState.findUniqueOrThrow({
          where: { campaignId: id },
        });
        const npcs = await tx.campaignNpc.findMany({
          where: {
            campaignId: id,
            placeEntityId: scene.placeEntityId,
            activeJourneyId: null,
          },
          include: { entity: true },
        });
        const turns = await tx.gameMasterTurn.findMany({
          where: { campaignId: id, playerEntityId: null },
          orderBy: { createdAt: 'desc' },
          take: 30,
        });
        return {
          mode: lore.mode,
          paused: lore.aiPaused,
          revision: lore.revision,
          npcs: npcs.map((n) => ({ id: n.entityId, name: n.entity.name })),
          turns: turns.map((t) => ({
            id: t.id,
            kind: t.kind,
            prompt: t.prompt,
            status: t.status,
            proposal: t.proposal ? (JSON.parse(t.proposal) as Proposal) : null,
            effect: t.proposal
              ? this.effect(
                  JSON.parse(t.context) as CopilotContext,
                  parseProposal(t.proposal),
                )
              : null,
            errorCode: t.errorCode,
            eventId: t.resultEventId,
            reviewedText: t.reviewedText,
            createdAt: t.createdAt,
            latencyMs: t.latencyMs,
            model: t.model,
            inputTokens: t.inputTokens,
            outputTokens: t.outputTokens,
            stale: t.expectedRevision !== lore.revision,
            sources: t.proposal
              ? (JSON.parse(t.context) as CopilotContext).sources.filter((s) =>
                  (JSON.parse(t.proposal!) as Proposal).evidenceIds.includes(
                    s.id,
                  ),
                )
              : [],
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    return { ...data, provider: await this.provider.status() };
  }
  async detail(id: string, userId: string, turnId: string) {
    await this.access(this.db, id, userId);
    const t = await this.db.gameMasterTurn.findFirst({
      where: { id: turnId, campaignId: id },
    });
    if (!t) throw new NotFoundException('Pedido não encontrado.');
    return {
      ...t,
      context: JSON.parse(t.context) as CopilotContext,
      proposal: t.proposal ? (JSON.parse(t.proposal) as Proposal) : null,
    };
  }
  private effect(context: CopilotContext, p: Proposal) {
    if (p.kind === 'TRAVEL') {
      const route = context.routes.find((r) => r.id === p.routeId);
      return `Viajar para ${route?.name} · ${route?.minutes} minutos para todo o grupo.`;
    }
    if (p.kind === 'REST')
      return `Descanso ${p.restType === 'LONG' ? 'longo · 480 minutos, recupera PV e espaços de magia' : 'curto · 60 minutos, sem recuperar PV ou espaços de magia'}.`;
    if (p.kind === 'DISCOVER')
      return `${context.npc?.name} informa a ${context.participants
        .filter((c) => p.knowerIds.includes(c.id))
        .map((c) => c.name)
        .join(
          ', ',
        )}: ${context.sources.find((s) => s.revisionId === p.revisionId && s.npcId === p.sourceNpcId)?.text}`;
    return 'Registrar o texto revisado, sem alterar estado físico, inventário ou fatos canônicos.';
  }
  async settings(
    id: string,
    userId: string,
    input: {
      mode: 'OFF' | 'COPILOT';
      paused: boolean;
      expectedRevision: number;
    },
  ) {
    return this.write(id, userId, async (tx) => {
      const lore = await this.access(tx, id, userId);
      if (lore.revision !== input.expectedRevision)
        throw new ConflictException(
          'A campanha mudou. Atualize antes de configurar.',
        );
      await tx.campaignLore.update({
        where: { campaignId: id },
        data: {
          mode: input.mode,
          aiPaused: input.paused,
          aiEpoch: { increment: 1 },
          revision: { increment: 1 },
        },
      });
      await tx.gameMasterTurn.updateMany({
        where: {
          campaignId: id,
          status: {
            in: ['REQUESTED', 'GENERATING', 'READY', 'WAITING_PLAYER'],
          },
        },
        data: {
          status: 'CANCELLED',
          errorCode: 'SETTINGS_CHANGED',
          resolvedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return { mode: input.mode, paused: input.paused };
    });
  }
  async request(
    id: string,
    userId: string,
    input: {
      requestKey: string;
      kind: TurnKind;
      prompt: string;
      focusEntityId?: string;
      expectedRevision: number;
    },
  ) {
    const normalized = {
      ...input,
      prompt: input.prompt.trim(),
      focusEntityId: input.focusEntityId || null,
    };
    const hash = createHash('sha256')
      .update(canonical(normalized))
      .digest('hex');
    return this.write(id, userId, async (tx) => {
      const lore = await this.access(tx, id, userId);
      const replay = await tx.gameMasterTurn.findUnique({
        where: {
          campaignId_requestKey: {
            campaignId: id,
            requestKey: input.requestKey,
          },
        },
      });
      if (replay) {
        if (replay.requestedById !== userId || replay.requestHash !== hash)
          throw new ConflictException('Chave já usada com outros dados.');
        return { id: replay.id, status: replay.status, alreadyRequested: true };
      }
      if (lore.mode !== 'COPILOT' || lore.aiPaused)
        throw new ConflictException(
          'Ligue ou retome o copiloto antes de pedir uma proposta.',
        );
      if (lore.revision !== input.expectedRevision)
        throw new ConflictException('A cena mudou. Atualize o pedido.');
      if (
        (await tx.gameMasterTurn.count({
          where: {
            campaignId: id,
            status: { in: ['REQUESTED', 'GENERATING', 'READY'] },
          },
        })) >= 3
      )
        throw new ConflictException(
          'Resolva os três pedidos pendentes antes de continuar.',
        );
      if (
        (await tx.gameMasterTurn.count({
          where: {
            campaignId: id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) >= 120
      )
        throw new ConflictException(
          'Limite de 120 pedidos nas últimas 24 horas atingido.',
        );
      const snapshot = await this.context.build(
        tx,
        id,
        input.kind,
        normalized.prompt,
        input.focusEntityId,
      );
      const turn = await tx.gameMasterTurn.create({
        data: {
          campaignId: id,
          requestedById: userId,
          requestKey: input.requestKey,
          requestHash: hash,
          kind: input.kind,
          prompt: normalized.prompt,
          focusEntityId: input.focusEntityId,
          expectedRevision: lore.revision,
          sceneRevision: snapshot.sceneRevision,
          epoch: lore.aiEpoch,
          context: JSON.stringify(snapshot),
        },
      });
      return { id: turn.id, status: turn.status, alreadyRequested: false };
    });
  }
  @Interval(2000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.runNext();
    } catch {
      /* Durable requests survive temporary database outages. */
    } finally {
      this.running = false;
    }
  }
  async runNext() {
    // Inference is safe to retry explicitly, but never resumes a mutation automatically.
    await this.db.gameMasterTurn.updateMany({
      where: { status: 'GENERATING', leaseUntil: { lt: new Date() } },
      data: {
        status: 'FAILED',
        errorCode: 'INTERRUPTED',
        resolvedAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
      },
    });
    const candidate = await this.db.gameMasterTurn.findFirst({
      where: { status: 'REQUESTED' },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return;
    const campaign = await this.db.campaign.findUnique({
      where: { id: candidate.campaignId },
      select: { masterId: true },
    });
    if (!campaign) return;
    const leaseToken = randomUUID();
    const claimed = await this.write(
      candidate.campaignId,
      campaign.masterId,
      async (tx) => {
        const turn = await tx.gameMasterTurn.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        if (turn.status !== 'REQUESTED') return false;
        const lore = await this.access(tx, turn.campaignId, campaign.masterId);
        if (
          (turn.playerEntityId
            ? !(await intentIsCurrent(tx, turn))
            : turn.requestedById !== campaign.masterId) ||
          lore.mode !== 'COPILOT' ||
          lore.aiPaused ||
          lore.aiEpoch !== turn.epoch ||
          lore.revision !== turn.expectedRevision
        ) {
          await tx.gameMasterTurn.update({
            where: { id: turn.id },
            data: {
              status: 'STALE',
              errorCode: 'STATE_CHANGED',
              resolvedAt: new Date(),
            },
          });
          return false;
        }
        await tx.gameMasterTurn.update({
          where: { id: turn.id },
          data: {
            status: 'GENERATING',
            leaseToken,
            leaseUntil: new Date(Date.now() + 300000),
          },
        });
        return true;
      },
    );
    if (!claimed) return;
    const snapshot = JSON.parse(candidate.context) as CopilotContext;
    let proposal: Proposal | undefined,
      result: ModelResult | undefined,
      errorCode = 'PROVIDER_UNAVAILABLE',
      attempts = 0;
    const started = Date.now();
    for (let attempt = 0; attempt < 2; attempt++) {
      attempts++;
      try {
        result = await this.provider.generate(candidate.context, attempt > 0);
        try {
          proposal = parseProposal(result.text);
          this.context.validate(snapshot, proposal);
          break;
        } catch {
          proposal = undefined;
          errorCode = 'INVALID_PROPOSAL';
        }
      } catch {
        errorCode = 'PROVIDER_UNAVAILABLE';
        break;
      }
    }
    await this.write(candidate.campaignId, campaign.masterId, async (tx) => {
      const turn = await tx.gameMasterTurn.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      if (turn.status !== 'GENERATING' || turn.leaseToken !== leaseToken)
        return;
      const lore = await this.access(tx, turn.campaignId, campaign.masterId);
      const stale =
        (turn.playerEntityId
          ? !(await intentIsCurrent(tx, turn))
          : turn.requestedById !== campaign.masterId) ||
        lore.revision !== turn.expectedRevision ||
        lore.aiEpoch !== turn.epoch ||
        lore.mode !== 'COPILOT' ||
        lore.aiPaused;
      await tx.gameMasterTurn.update({
        where: { id: turn.id },
        data: {
          status: stale ? 'STALE' : proposal ? 'READY' : 'FAILED',
          proposal: !stale && proposal ? JSON.stringify(proposal) : null,
          errorCode: stale ? 'STATE_CHANGED' : proposal ? null : errorCode,
          model: result?.model,
          inputTokens: result?.inputTokens,
          outputTokens: result?.outputTokens,
          latencyMs: Date.now() - started,
          attempts,
          leaseToken: null,
          leaseUntil: null,
          resolvedAt: stale || !proposal ? new Date() : null,
        },
      });
    });
  }
  async resolve(
    id: string,
    userId: string,
    turnId: string,
    input: {
      decision: 'ACCEPT' | 'CANCEL';
      text?: string;
      visibility?: 'MASTER' | 'PUBLIC';
    },
  ) {
    return this.write(id, userId, async (tx) => {
      const turn = await tx.gameMasterTurn.findFirst({
        where: { id: turnId, campaignId: id },
      });
      if (!turn) throw new NotFoundException('Pedido não encontrado.');
      if (turn.playerEntityId)
        throw new ConflictException('Revise esta conversa na tela Intenções.');
      if (turn.status === 'COMMITTED') {
        if (input.decision !== 'ACCEPT')
          throw new ConflictException('A proposta já foi aplicada.');
        if (input.text && input.text.trim() !== turn.reviewedText)
          throw new ConflictException(
            'Esta proposta já foi aprovada com outro texto. Consulte o registro original.',
          );
        if (input.visibility && turn.resultEventId) {
          const original = await tx.storyEvent.findUniqueOrThrow({
            where: { id: turn.resultEventId },
            include: { audience: true },
          });
          if (original.audience.scope !== input.visibility)
            throw new ConflictException(
              'Esta proposta já foi aprovada com outra visibilidade.',
            );
        }
        return {
          id: turn.id,
          eventId: turn.resultEventId,
          alreadyApplied: true,
        };
      }
      if (input.decision === 'CANCEL') {
        if (turn.status !== 'CANCELLED')
          await tx.gameMasterTurn.update({
            where: { id: turnId },
            data: {
              status: 'CANCELLED',
              leaseToken: null,
              leaseUntil: null,
              resolvedAt: new Date(),
            },
          });
        return {
          id: turnId,
          eventId: null,
          alreadyApplied: turn.status === 'CANCELLED',
        };
      }
      const lore = await this.access(tx, id, userId);
      if (turn.status !== 'READY' || !turn.proposal)
        throw new ConflictException(
          'Esta proposta não está pronta para aprovação.',
        );
      if (
        lore.mode !== 'COPILOT' ||
        lore.aiPaused ||
        lore.aiEpoch !== turn.epoch ||
        lore.revision !== turn.expectedRevision
      )
        throw new ConflictException(
          'A proposta ficou desatualizada ou o copiloto foi pausado. Cancele e consulte novamente.',
        );
      const snapshot = JSON.parse(turn.context) as CopilotContext,
        p = parseProposal(turn.proposal);
      this.context.validate(snapshot, p);
      // Rebuild to recheck physical NPC presence and latest observations, even after manual edits.
      const current = await this.context.build(
        tx,
        id,
        turn.kind as TurnKind,
        turn.prompt,
        turn.focusEntityId ?? undefined,
      );
      this.context.validate(current, p);
      let eventId: string | null = null;
      let reviewedText: string | null = null;
      if (p.kind === 'TRAVEL' || p.kind === 'REST') {
        const op =
          p.kind === 'TRAVEL'
            ? { kind: 'TRAVEL' as const, routeId: p.routeId! }
            : { kind: 'REST' as const, type: p.restType! };
        const action = await this.game.request(
          id,
          { kind: 'USER', userId },
          {
            requestKey: turn.id,
            expectedSceneRevision: turn.sceneRevision,
            operation: op,
          },
          tx,
        );
        const result = await this.game.resolve(
          id,
          action.id,
          { kind: 'USER', userId },
          { decision: 'COMMIT', expectedRevision: turn.expectedRevision },
          tx,
        );
        eventId = result.eventId;
      } else if (p.kind === 'DISCOVER') {
        const source = current.sources.find(
          (s) => s.npcId === p.sourceNpcId && s.revisionId === p.revisionId,
        )!;
        const result = await this.story.command(
          id,
          userId,
          {
            requestKey: turn.id,
            expectedRevision: turn.expectedRevision,
            operation: {
              kind: 'DISCOVER',
              revisionId: p.revisionId!,
              knowerIds: p.knowerIds,
              stance:
                source.stance === 'KNOWN'
                  ? 'KNOWN'
                  : source.stance === 'SUSPECTED'
                    ? 'SUSPECTED'
                    : 'BELIEVED',
              source: `Conversa com ${current.npc!.name}, confirmada pelo mestre.`,
            },
          },
          tx,
        );
        eventId = result.eventId;
      } else {
        reviewedText = input.text?.trim() || p.text;
        const result = await this.story.command(
          id,
          userId,
          {
            requestKey: turn.id,
            expectedRevision: turn.expectedRevision,
            operation: {
              kind: 'NOTE',
              text: reviewedText,
              entityIds: current.npc ? [current.npc.id] : [],
              audience: {
                scope: input.visibility ?? 'MASTER',
                recipientIds: [],
              },
            },
          },
          tx,
        );
        eventId = result.eventId;
      }
      await tx.gameMasterTurn.update({
        where: { id: turnId },
        data: {
          status: 'COMMITTED',
          reviewedText,
          resultEventId: eventId,
          resolvedAt: new Date(),
        },
      });
      return { id: turnId, eventId, alreadyApplied: false };
    });
  }
}
