import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  applyConsequence,
  futureMinute,
  hash,
  npcHash,
  pendingStatuses,
  record,
  travelState,
} from './consequence-engine';
type Tx = Prisma.TransactionClient;
export type ScheduleInput = {
  expectedRevision: number;
  requestKey: string;
  kind: 'REMINDER' | 'NPC_DEPART';
  title: string;
  text?: string;
  delayMinutes: number;
  autoApproved: boolean;
  npcEntityId?: string;
  routeId?: string;
};
export type PolicyInput = {
  expectedRevision: number;
  enabled: boolean;
  paused: boolean;
  allowNpcTravel: boolean;
  maxPerAdvance: number;
};

@Injectable()
export class ConsequencesService {
  constructor(private readonly db: PrismaService) {}
  private async access(tx: Tx, id: string, userId: string, revision?: number) {
    const campaign = await tx.campaign.findUnique({
      where: { id },
      include: { lore: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.masterId !== userId)
      throw new ForbiddenException('Somente o mestre gerencia os prazos.');
    const calendar = await tx.campaignCalendar.findUnique({
      where: { campaignId: id },
    });
    if (!campaign.lore?.domainVersion || !calendar)
      throw new ConflictException('Prepare o cenário e os comandos primeiro.');
    if (revision !== undefined && campaign.lore.revision !== revision)
      throw new ConflictException('A campanha mudou. Atualize os prazos.');
    return { ...campaign, calendar };
  }
  private async write<T>(id: string, fn: (tx: Tx) => Promise<T>) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${id} FOR UPDATE`;
            return fn(tx);
          },
          { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 },
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === 'P2034' && attempt < 2) continue;
          if (['P2034', 'P2002'].includes(e.code))
            throw new ConflictException(
              'Conflito de estado. Atualize os prazos.',
            );
        }
        throw e;
      }
    }
  }
  async state(id: string, userId: string) {
    return this.db.$transaction(
      async (tx) => {
        const campaign = await this.access(tx, id, userId);
        const policy = await tx.worldAutomationPolicy.findUnique({
          where: { campaignId: id },
        });
        const npcs = await tx.campaignNpc.findMany({
          where: { campaignId: id },
          include: { entity: true, place: { include: { entity: true } } },
          orderBy: { entity: { name: 'asc' } },
        });
        const routes = await tx.travelRoute.findMany({
          where: { campaignId: id },
          include: {
            from: { include: { entity: true } },
            to: { include: { entity: true } },
          },
        });
        const pending = await tx.scheduledConsequence.findMany({
          where: { campaignId: id, status: { in: [...pendingStatuses] } },
          orderBy: [{ dueMinute: 'asc' }, { id: 'asc' }],
        });
        const history = await tx.scheduledConsequence.findMany({
          where: { campaignId: id, status: { in: ['APPLIED', 'CANCELLED'] } },
          orderBy: { resolvedAt: 'desc' },
          take: 30,
        });
        return {
          revision: campaign.lore!.revision,
          totalMinutes: campaign.calendar.totalMinutes,
          aiPaused: campaign.lore!.aiPaused,
          policy: policy
            ? {
                enabled: policy.enabled,
                paused: policy.paused,
                allowNpcTravel: policy.allowNpcTravel,
                maxPerAdvance: policy.maxPerAdvance,
              }
            : {
                enabled: false,
                paused: false,
                allowNpcTravel: false,
                maxPerAdvance: 4,
              },
          npcs: npcs.map((n) => ({
            id: n.entityId,
            name: n.entity.name,
            placeId: n.placeEntityId,
            place: n.place.entity.name,
            travelling: !!n.activeJourneyId,
          })),
          routes: routes.map((r) => ({
            id: r.id,
            fromId: r.fromEntityId,
            to: r.to.entity.name,
            minutes: r.minutes,
            blocked: r.blocked,
          })),
          items: [...pending, ...history].map((i) => ({
            id: i.id,
            title: i.title,
            text: i.text,
            kind: i.kind,
            status: i.status,
            dueMinute: i.dueMinute,
            autoApproved: i.autoApproved,
            reasonCode: i.reasonCode,
            npcId: i.npcEntityId,
            routeId: i.routeId,
            npc:
              npcs.find((n) => n.entityId === i.npcEntityId)?.entity.name ??
              null,
            from:
              routes.find((r) => r.id === i.routeId)?.from.entity.name ?? null,
            to: routes.find((r) => r.id === i.routeId)?.to.entity.name ?? null,
            travelMinutes: i.travelMinutes,
            eventId: i.resultEventId,
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async policy(id: string, userId: string, input: PolicyInput) {
    return this.write(id, async (tx) => {
      const campaign = await this.access(
        tx,
        id,
        userId,
        input.expectedRevision,
      );
      const { expectedRevision: _revision, ...values } = input;
      void _revision;
      await tx.worldAutomationPolicy.upsert({
        where: { campaignId: id },
        create: { campaignId: id, configuredById: userId, ...values },
        update: { configuredById: userId, ...values },
      });
      await record(
        tx,
        id,
        campaign.calendar.totalMinutes,
        'AUTOMATION_CONFIGURED',
        'O mestre atualizou a política de prazos.',
        values,
        userId,
      );
      return { saved: true };
    });
  }
  private async capacity(tx: Tx, id: string, adding = 1) {
    if (
      (await tx.scheduledConsequence.count({
        where: { campaignId: id, status: { in: [...pendingStatuses] } },
      })) +
        adding >
      60
    )
      throw new ConflictException(
        'Resolva os prazos pendentes antes de adicionar mais (limite 60).',
      );
  }
  async schedule(id: string, userId: string, input: ScheduleInput) {
    return this.write(id, async (tx) => {
      await this.access(tx, id, userId);
      const requestHash = hash([
        input.kind,
        input.title,
        input.text ?? '',
        input.delayMinutes,
        input.autoApproved,
        input.npcEntityId ?? null,
        input.routeId ?? null,
      ]);
      const old = await tx.scheduledConsequence.findUnique({
        where: {
          campaignId_requestKey: {
            campaignId: id,
            requestKey: input.requestKey,
          },
        },
      });
      if (old) {
        if (old.requestHash !== requestHash || old.createdById !== userId)
          throw new ConflictException('Esta chave já identifica outro prazo.');
        return { id: old.id, alreadyApplied: true };
      }
      const campaign = await this.access(
        tx,
        id,
        userId,
        input.expectedRevision,
      );
      await this.capacity(tx, id);
      if (
        !input.title.trim() ||
        (input.kind === 'REMINDER' && (input.npcEntityId || input.routeId)) ||
        (input.kind === 'NPC_DEPART' && (!input.npcEntityId || !input.routeId))
      )
        throw new ConflictException(
          'Preencha apenas os campos da capacidade escolhida.',
        );
      const dueMinute = futureMinute(
        campaign.calendar.totalMinutes,
        input.delayMinutes,
      );
      let travel: { npcStateHash: string; travelMinutes: number } | undefined;
      let itinerary:
        | { fromId: string; toId: string; minutes: number }
        | undefined;
      if (input.kind === 'NPC_DEPART') {
        const state = await travelState(
          tx,
          {
            campaignId: id,
            kind: input.kind,
            npcEntityId: input.npcEntityId!,
            routeId: input.routeId!,
            parentId: null,
            npcStateHash: null,
            travelMinutes: null,
          },
          [],
          false,
        );
        if (state.reason)
          throw new ConflictException(`Viagem indisponível: ${state.reason}.`);
        futureMinute(dueMinute, state.route.minutes);
        if (
          await tx.scheduledConsequence.count({
            where: {
              campaignId: id,
              npcEntityId: input.npcEntityId,
              status: { in: [...pendingStatuses] },
            },
          })
        )
          throw new ConflictException(
            'Este NPC já possui uma viagem pendente.',
          );
        travel = {
          npcStateHash: npcHash(state.npc, state.route),
          travelMinutes: state.route.minutes,
        };
        itinerary = {
          fromId: state.route.fromEntityId,
          toId: state.route.toEntityId,
          minutes: state.route.minutes,
        };
      }
      const item = await tx.scheduledConsequence.create({
        data: {
          campaignId: id,
          createdById: userId,
          requestKey: input.requestKey,
          requestHash,
          kind: input.kind,
          title: input.title.trim(),
          text: input.text?.trim() ?? '',
          dueMinute,
          autoApproved: input.autoApproved,
          npcEntityId: input.npcEntityId,
          routeId: input.routeId,
          ...travel,
        },
      });
      await record(
        tx,
        id,
        campaign.calendar.totalMinutes,
        'CONSEQUENCE_SCHEDULED',
        `Prazo preparado: ${item.title}.`,
        {
          consequenceId: item.id,
          dueMinute,
          kind: item.kind,
          autoApproved: item.autoApproved,
          npcEntityId: item.npcEntityId,
          routeId: item.routeId,
          npcStateHash: item.npcStateHash,
          itinerary,
        },
        userId,
      );
      return { id: item.id, alreadyApplied: false };
    });
  }
  async resolve(
    id: string,
    userId: string,
    itemId: string,
    input: { expectedRevision: number; decision: 'APPLY' | 'CANCEL' },
  ) {
    return this.write(id, async (tx) => {
      await this.access(tx, id, userId);
      const item = await tx.scheduledConsequence.findFirst({
        where: { campaignId: id, id: itemId },
      });
      if (!item) throw new NotFoundException('Prazo não encontrado.');
      if (item.status === 'APPLIED' || item.status === 'CANCELLED') {
        if ((item.status === 'APPLIED') !== (input.decision === 'APPLY'))
          throw new ConflictException('Prazo já resolvido com outra decisão.');
        return { alreadyApplied: true };
      }
      const campaign = await this.access(
        tx,
        id,
        userId,
        input.expectedRevision,
      );
      const now = campaign.calendar.totalMinutes;
      if (input.decision === 'CANCEL') {
        if (item.kind === 'NPC_ARRIVE')
          throw new ConflictException(
            'O NPC já partiu. Adie ou confirme a chegada; cancelar não desfaz a viagem.',
          );
        const event = await record(
          tx,
          id,
          now,
          'CONSEQUENCE_CANCELLED',
          `Prazo cancelado: ${item.title}.`,
          { consequenceId: item.id },
          userId,
        );
        await tx.scheduledConsequence.update({
          where: { id: item.id },
          data: {
            status: 'CANCELLED',
            resultEventId: event.id,
            resolvedAt: new Date(),
            reasonCode: null,
          },
        });
      } else {
        if (item.dueMinute > now)
          throw new ConflictException('Este prazo ainda não venceu.');
        const reason = await applyConsequence(tx, item, now, userId);
        if (reason)
          throw new ConflictException(
            `Revise as condições antes de aplicar: ${reason}.`,
          );
      }
      return { alreadyApplied: false };
    });
  }
  async postpone(
    id: string,
    userId: string,
    itemId: string,
    input: {
      expectedRevision: number;
      delayMinutes: number;
      autoApproved: boolean;
    },
  ) {
    return this.write(id, async (tx) => {
      const campaign = await this.access(
        tx,
        id,
        userId,
        input.expectedRevision,
      );
      const item = await tx.scheduledConsequence.findFirst({
        where: {
          campaignId: id,
          id: itemId,
          status: { in: [...pendingStatuses] },
        },
      });
      if (!item) throw new NotFoundException('Prazo pendente não encontrado.');
      const dueMinute = futureMinute(
        campaign.calendar.totalMinutes,
        input.delayMinutes,
      );
      if (dueMinute <= item.dueMinute)
        throw new ConflictException(
          'O novo prazo deve ser posterior ao anterior.',
        );
      let npcStateHash = item.npcStateHash;
      if (item.kind !== 'REMINDER') {
        const state = await travelState(tx, item, [], false);
        if (state.reason)
          throw new ConflictException(
            `Revise as condições antes de adiar: ${state.reason}.`,
          );
        npcStateHash = npcHash(state.npc, state.route);
        if (item.kind === 'NPC_DEPART')
          futureMinute(dueMinute, state.route.minutes);
      }
      await tx.scheduledConsequence.update({
        where: { id: item.id },
        data: {
          dueMinute,
          npcStateHash,
          autoApproved: input.autoApproved,
          createdById: userId,
          status: 'SCHEDULED',
          reasonCode: null,
        },
      });
      await record(
        tx,
        id,
        campaign.calendar.totalMinutes,
        'CONSEQUENCE_SCHEDULED',
        `Prazo adiado: ${item.title}.`,
        {
          consequenceId: item.id,
          previousMinute: item.dueMinute,
          dueMinute,
          autoApproved: input.autoApproved,
        },
        userId,
      );
      return { saved: true };
    });
  }
  async preset(
    id: string,
    userId: string,
    input: { expectedRevision: number; autoApproved: boolean },
  ) {
    return this.write(id, async (tx) => {
      const campaign = await this.access(
        tx,
        id,
        userId,
        input.expectedRevision,
      );
      const pack = await tx.lorePackVersion.findUniqueOrThrow({
        where: { id: campaign.lore!.packVersionId },
      });
      if (pack.packKey !== 'eldoria-tres-sinos' || pack.version !== '1.0.0')
        throw new ConflictException('Pacote sem marcos preparados.');
      const genesis = await tx.storyEvent.findFirstOrThrow({
        where: { campaignId: id, kind: 'GENESIS' },
      });
      const entries = [
        [
          720,
          'Preparação do caixote',
          'Verificar se o caixote permanece na mina e se Mara pode preparar o transporte.',
        ],
        [
          1440,
          'Partida do caixote',
          'Verificar preparação e interferências antes de decidir o transporte do caixote.',
        ],
        [
          1530,
          'Chegada do caixote',
          'Verificar se houve partida, transporte e interceptação. Este lembrete não move a carga.',
        ],
        [
          2160,
          'Vigia e ponte',
          'Verificar a inatividade do Vigia e decidir as consequências para a ponte.',
        ],
        [
          2880,
          'Galeria e Conselho',
          'Reavaliar a água na galeria e a resposta do Conselho conforme os eventos registrados.',
        ],
        [
          2880,
          'Condição de Bento',
          'Reavaliar atendimento e condição de Bento. Nenhum dano ou morte é aplicado por este lembrete.',
        ],
      ] as const;
      let created = 0;
      for (const [delay, title, text] of entries) {
        const requestKey = `lore-pressure-v1:${title}`;
        if (
          await tx.scheduledConsequence.findUnique({
            where: { campaignId_requestKey: { campaignId: id, requestKey } },
          })
        )
          continue;
        await this.capacity(tx, id);
        const dueMinute = futureMinute(genesis.gameMinute, delay),
          overdue = dueMinute <= campaign.calendar.totalMinutes;
        const item = await tx.scheduledConsequence.create({
          data: {
            campaignId: id,
            createdById: userId,
            requestKey,
            requestHash: hash([title, delay]),
            kind: 'REMINDER',
            title,
            text,
            dueMinute,
            autoApproved: input.autoApproved,
            status: overdue ? 'WAITING_MASTER' : 'SCHEDULED',
            reasonCode: overdue ? 'OVERDUE' : null,
          },
        });
        await record(
          tx,
          id,
          campaign.calendar.totalMinutes,
          'CONSEQUENCE_SCHEDULED',
          `Marco da lore preparado: ${title}.`,
          {
            consequenceId: item.id,
            dueMinute,
            autoApproved: input.autoApproved,
          },
          userId,
        );
        created++;
      }
      return { created };
    });
  }
}
