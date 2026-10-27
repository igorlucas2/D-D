import { ConflictException } from '@nestjs/common';
import type {
  CampaignNpc,
  Prisma,
  ScheduledConsequence,
  StoryEventKind,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { enqueueStory } from '../story/story-outbox';

type Tx = Prisma.TransactionClient;
export const pendingStatuses = ['SCHEDULED', 'WAITING_MASTER'] as const;
export const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function npcHash(
  npc: CampaignNpc,
  route: { fromEntityId: string; toEntityId: string; minutes: number },
) {
  return hash([
    npc.placeEntityId,
    npc.currentHp,
    npc.conditions,
    npc.activeJourneyId,
    route.fromEntityId,
    route.toEntityId,
    route.minutes,
  ]);
}
export function futureMinute(now: number, delay: number) {
  const due = now + delay;
  if (
    !Number.isInteger(delay) ||
    delay < 1 ||
    delay > 43200 ||
    due > 2147483647
  )
    throw new ConflictException('Prazo fora dos limites do calendário.');
  return due;
}
export async function record(
  tx: Tx,
  campaignId: string,
  minute: number,
  kind: StoryEventKind,
  summary: string,
  payload: object,
  userId?: string,
  entityId?: string,
) {
  const lore = await tx.campaignLore.update({
    where: { campaignId },
    data: { revision: { increment: 1 }, storySequence: { increment: 1 } },
  });
  const audience = await tx.storyAudience.create({
    data: { campaignId, scope: 'MASTER' },
  });
  const user = userId
    ? await tx.user.findUniqueOrThrow({ where: { id: userId } })
    : null;
  const event = await tx.storyEvent.create({
    data: {
      campaignId,
      sequence: lore.storySequence,
      gameMinute: minute,
      kind,
      actorKind: user ? 'USER' : 'SYSTEM',
      actorUserId: userId,
      actorName: user?.displayName ?? 'Prazos autorizados',
      audienceId: audience.id,
      summary,
      payload: JSON.stringify({ schemaVersion: 1, ...payload }),
      ...(entityId ? { entities: { create: [{ entityId }] } } : {}),
    },
  });
  await enqueueStory(tx, campaignId, event.id);
  return event;
}

// All observations retain their original revision. Only the travelling NPC learns its new position.
async function locationFact(
  tx: Tx,
  item: ScheduledConsequence,
  eventId: string,
  audienceId: string,
  text: string,
) {
  const campaignId = item.campaignId,
    entityId = item.npcEntityId!;
  const key = `NPC_LOC_${entityId}`;
  let fact = await tx.storyFact.findUnique({
    where: { campaignId_key: { campaignId, key } },
    include: { subjects: true },
  });
  if (
    fact &&
    (fact.predicate !== 'NPC_LOCATION' ||
      fact.subjects.length !== 1 ||
      fact.subjects[0].entityId !== entityId)
  )
    throw new ConflictException('Vínculo factual do NPC precisa de revisão.');
  if (fact)
    fact = await tx.storyFact.update({
      where: { id: fact.id },
      data: { currentVersion: { increment: 1 } },
      include: { subjects: true },
    });
  else
    fact = await tx.storyFact.create({
      data: {
        campaignId,
        key,
        kind: 'FACT',
        classification: 'MUTABLE',
        predicate: 'NPC_LOCATION',
        subjects: { create: [{ entityId }] },
      },
      include: { subjects: true },
    });
  const revision = await tx.storyFactRevision.create({
    data: {
      campaignId,
      factId: fact.id,
      version: fact.currentVersion,
      text,
      sourceEventId: eventId,
      audienceId,
    },
  });
  await tx.entityKnowledge.create({
    data: {
      campaignId,
      knowerEntityId: entityId,
      factRevisionId: revision.id,
      stance: 'KNOWN',
      source: 'Deslocamento próprio registrado.',
      sourceEventId: eventId,
    },
  });
}

export async function travelState(
  tx: Tx,
  item: Pick<
    ScheduledConsequence,
    | 'campaignId'
    | 'npcEntityId'
    | 'routeId'
    | 'kind'
    | 'parentId'
    | 'npcStateHash'
    | 'travelMinutes'
  >,
  occupied: string[] = [],
  verifyHash = true,
) {
  const npc = await tx.campaignNpc.findFirst({
    where: { campaignId: item.campaignId, entityId: item.npcEntityId! },
    include: { entity: true },
  });
  const route = await tx.travelRoute.findFirst({
    where: { campaignId: item.campaignId, id: item.routeId! },
    include: {
      from: { include: { entity: true } },
      to: { include: { entity: true } },
    },
  });
  if (!npc || !route)
    throw new ConflictException('NPC ou rota indisponível nesta campanha.');
  let reason: string | null = null;
  if (
    route.blocked ||
    route.minutes < 1 ||
    route.minutes > 1440 ||
    (item.travelMinutes !== null && route.minutes !== item.travelMinutes)
  )
    reason = 'ROUTE_CHANGED';
  else if (npc.currentHp <= 0 || npc.conditions !== '[]')
    reason = 'NPC_UNAVAILABLE';
  else if (npc.placeEntityId !== route.fromEntityId) reason = 'NPC_MOVED';
  else if (
    item.kind === 'NPC_DEPART'
      ? !!npc.activeJourneyId
      : npc.activeJourneyId !== item.parentId
  )
    reason = 'JOURNEY_CHANGED';
  else if (verifyHash && npcHash(npc, route) !== item.npcStateHash)
    reason = 'NPC_CHANGED';
  else if (
    await tx.combatEncounter.findUnique({
      where: { campaignId: item.campaignId },
    })
  )
    reason = 'COMBAT';
  else if (
    occupied.includes(
      item.kind === 'NPC_DEPART' ? route.fromEntityId : route.toEntityId,
    )
  )
    reason = 'GROUP_PRESENT';
  else if (
    await tx.gameMasterTurn.count({
      where: {
        campaignId: item.campaignId,
        focusEntityId: npc.entityId,
        playerEntityId: { not: null },
        status: {
          in: [
            'REQUESTED',
            'GENERATING',
            'READY',
            'FAILED',
            'STALE',
            'WAITING_PLAYER',
          ],
        },
      },
    })
  )
    reason = 'CONVERSATION_PENDING';
  return { npc, route, reason };
}

export async function applyConsequence(
  tx: Tx,
  item: ScheduledConsequence,
  minute: number,
  userId?: string,
  occupied: string[] = [],
) {
  let text = item.text || item.title;
  let eventKind: StoryEventKind = 'SCHEDULED_NOTICE';
  if (item.kind !== 'REMINDER') {
    const { npc, route, reason } = await travelState(tx, item, occupied);
    if (reason) return reason;
    if (item.kind === 'NPC_DEPART') {
      const arrivalMinute = futureMinute(minute, route.minutes);
      const moving = await tx.campaignNpc.update({
        where: { entityId: npc.entityId },
        data: { activeJourneyId: item.id },
      });
      text = `${npc.entity.name} partiu de ${route.from.entity.name} para ${route.to.entity.name}; está em viagem até o minuto ${arrivalMinute}.`;
      eventKind = 'NPC_DEPARTED';
      await tx.scheduledConsequence.create({
        data: {
          campaignId: item.campaignId,
          requestKey: `arrival:${item.id}`,
          requestHash: hash([item.id, arrivalMinute]),
          createdById: userId ?? item.createdById,
          kind: 'NPC_ARRIVE',
          title: `Chegada de ${npc.entity.name}`,
          text: '',
          dueMinute: arrivalMinute,
          autoApproved: item.autoApproved,
          npcEntityId: npc.entityId,
          routeId: route.id,
          travelMinutes: route.minutes,
          npcStateHash: npcHash(moving, route),
          parentId: item.id,
        },
      });
    } else {
      const parent = await tx.scheduledConsequence.findFirst({
        where: {
          campaignId: item.campaignId,
          id: item.parentId!,
          status: 'APPLIED',
        },
      });
      if (!parent) return 'JOURNEY_CHANGED';
      await tx.campaignNpc.update({
        where: { entityId: npc.entityId },
        data: { placeEntityId: route.toEntityId, activeJourneyId: null },
      });
      text = `${npc.entity.name} chegou a ${route.to.entity.name}, vindo de ${route.from.entity.name}.`;
      eventKind = 'NPC_ARRIVED';
    }
  }
  const event = await record(
    tx,
    item.campaignId,
    minute,
    eventKind,
    text,
    {
      consequenceId: item.id,
      dueMinute: item.dueMinute,
      authorizedById: item.createdById,
      automatic: !userId,
    },
    userId,
    item.npcEntityId ?? undefined,
  );
  if (item.kind !== 'REMINDER')
    await locationFact(tx, item, event.id, event.audienceId, text);
  await tx.scheduledConsequence.update({
    where: { id: item.id },
    data: {
      status: 'APPLIED',
      resultEventId: event.id,
      reasonCode: null,
      resolvedAt: new Date(),
    },
  });
  return null;
}

// Runs inside the approved clock command's transaction, never on wall time or inference output.
export async function processConsequences(
  tx: Tx,
  campaignId: string,
  from: number,
  to: number,
  occupied: string[],
) {
  const lore = await tx.campaignLore.findUniqueOrThrow({
    where: { campaignId },
    include: { automationPolicy: true, campaign: true },
  });
  const policy = lore.automationPolicy;
  let applied = 0;
  // At most 60 outstanding items; each departure can add one arrival.
  for (let i = 0; i < 120; i++) {
    const item = await tx.scheduledConsequence.findFirst({
      where: { campaignId, status: 'SCHEDULED', dueMinute: { lte: to } },
      orderBy: [{ dueMinute: 'asc' }, { id: 'asc' }],
    });
    if (!item) break;
    let reason = !policy?.enabled
      ? 'DISABLED'
      : policy.paused || lore.aiPaused
        ? 'PAUSED'
        : policy.configuredById !== lore.campaign.masterId ||
            item.createdById !== lore.campaign.masterId
          ? 'AUTHORIZATION_CHANGED'
          : !item.autoApproved
            ? 'APPROVAL_REQUIRED'
            : item.dueMinute <= from
              ? 'OVERDUE'
              : item.kind !== 'REMINDER' && !policy.allowNpcTravel
                ? 'TRAVEL_DISABLED'
                : applied >= policy.maxPerAdvance
                  ? 'BUDGET'
                  : null;
    if (!reason)
      reason = await applyConsequence(
        tx,
        item,
        item.dueMinute,
        undefined,
        occupied,
      );
    if (reason) {
      await tx.scheduledConsequence.update({
        where: { id: item.id },
        data: { status: 'WAITING_MASTER', reasonCode: reason },
      });
    } else applied++;
  }
}
