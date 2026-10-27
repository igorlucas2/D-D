import type { Prisma } from '@prisma/client';
import type { LorePack } from '../lore/lore.types';
import { enqueueStory } from './story-outbox';

// Called inside installation/backfill transaction. Never reads the bundled files.
export async function seedStory(
  tx: Prisma.TransactionClient,
  campaignId: string,
) {
  const lore = await tx.campaignLore.findUniqueOrThrow({
    where: { campaignId },
    include: { packVersion: true },
  });
  if (lore.storySequence > 0) return;
  const pack = JSON.parse(lore.packVersion.snapshot) as LorePack;
  const entities = await tx.campaignEntity.findMany({ where: { campaignId } });
  const entityIds = new Map(entities.map((e) => [e.key, e.id]));
  const entityId = (key: string) => {
    const id = entityIds.get(key);
    if (!id) throw new Error('Installed snapshot/entity mismatch');
    return id;
  };
  const privateAudience = await tx.storyAudience.create({
    data: { campaignId, scope: 'MASTER' },
  });
  const publicAudience = await tx.storyAudience.create({
    data: { campaignId, scope: 'PUBLIC' },
  });
  const calendar = await tx.campaignCalendar.findUniqueOrThrow({
    where: { campaignId },
  });
  const genesis = await tx.storyEvent.create({
    data: {
      campaignId,
      sequence: 1,
      kind: 'GENESIS',
      gameMinute: calendar.totalMinutes,
      actorKind: 'SYSTEM',
      actorName: 'Instalação do cenário',
      audienceId: privateAudience.id,
      summary: 'Memória inicial importada do cenário instalado.',
      payload: JSON.stringify({
        schemaVersion: 1,
        packVersionId: lore.packVersionId,
        installedHash: lore.installedHash,
        origin: 'INSTALLED_SNAPSHOT',
        installedAt: lore.installedAt.toISOString(),
      }),
    },
  });
  const revisions = new Map<string, string>();
  await enqueueStory(tx, campaignId, genesis.id);
  for (const f of [
    ...pack.facts.facts.map((f) => ({
      ...f,
      kind: 'FACT' as const,
      evaluation: null as string | null,
    })),
    ...pack.facts.claims.map((c) => ({
      id: c.id,
      text: c.text,
      kind: 'CLAIM' as const,
      mutability: 'FIXED',
      audience: 'MASTER',
      evaluation: c.truth,
      subjects: [
        ...new Set(
          c.factIds.flatMap(
            (key) => pack.facts.facts.find((f) => f.id === key)!.subjects,
          ),
        ),
      ],
    })),
  ]) {
    const fact = await tx.storyFact.create({
      data: {
        campaignId,
        key: f.id,
        kind: f.kind,
        classification: f.mutability === 'FIXED' ? 'FIXED' : 'MUTABLE',
      },
    });
    const revision = await tx.storyFactRevision.create({
      data: {
        campaignId,
        factId: fact.id,
        version: 1,
        text: f.text,
        evaluation: f.evaluation,
        sourceEventId: genesis.id,
        audienceId:
          f.audience === 'PUBLIC' ? publicAudience.id : privateAudience.id,
      },
    });
    revisions.set(f.id, revision.id);
    for (const subject of f.subjects)
      await tx.storyFactSubject.create({
        data: { campaignId, factId: fact.id, entityId: entityId(subject) },
      });
  }
  for (const k of pack.facts.knowledge)
    await tx.entityKnowledge.create({
      data: {
        campaignId,
        knowerEntityId: entityId(k.npcId),
        factRevisionId: revisions.get(k.targetId)!,
        stance:
          k.stance === 'KNOWS'
            ? 'KNOWN'
            : k.stance === 'BELIEVES'
              ? 'BELIEVED'
              : 'SUSPECTED',
        source: k.source,
        sourceEventId: genesis.id,
      },
    });
  for (const r of pack.entities.relations)
    await tx.storyRelationship.create({
      data: {
        campaignId,
        fromEntityId: entityId(r.from),
        toEntityId: entityId(r.to),
        description: {
          TRUSTS: 'Confia nesta pessoa.',
          FRIEND: 'Mantém amizade.',
          RESPECTS: 'Respeita esta pessoa.',
          OWES_PAYMENT: 'Deve um pagamento; termos ainda não formalizados.',
          DISTRUSTS: 'Desconfia desta pessoa.',
        }[r.kind],
        trust: 0,
        fear: 0,
        audienceId: privateAudience.id,
        sourceEventId: genesis.id,
      },
    });
  for (const thread of pack.threads.threads)
    await tx.storyThread.create({
      data: {
        campaignId,
        key: thread.id,
        objective: thread.objective,
        completion: thread.completion,
        consequence: thread.consequence,
        audienceId: privateAudience.id,
        sourceEventId: genesis.id,
      },
    });
  await tx.eventEntity.createMany({
    data: entities.map((e) => ({
      campaignId,
      eventId: genesis.id,
      entityId: e.id,
    })),
  });
  await tx.campaignLore.update({
    where: { campaignId },
    data: { storySequence: 1, revision: { increment: 1 } },
  });
}
