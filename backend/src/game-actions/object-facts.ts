import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { enqueueStory } from '../story/story-outbox';
type Tx = Prisma.TransactionClient;

export async function syncObjectFacts(
  tx: Tx,
  campaignId: string,
  eventId: string,
  objectIds: string[],
) {
  const objects = await tx.campaignPlotObject.findMany({
    where: { campaignId },
    include: {
      entity: true,
      place: { include: { entity: true } },
      carrier: { include: { entity: true } },
      locationFact: {
        include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
      },
    },
  });
  const byId = new Map(objects.map((o) => [o.entityId, o]));
  for (const id of [...new Set(objectIds)]) {
    const o = byId.get(id)!;
    if (!o?.locationFact)
      throw new ConflictException(
        'Objeto sem vínculo factual. Revise a preparação dos comandos.',
      );
    let root = o;
    const visited = new Set<string>();
    while (root.containerEntityId) {
      if (visited.has(root.entityId))
        throw new ConflictException('Ciclo de recipientes detectado.');
      visited.add(root.entityId);
      root = byId.get(root.containerEntityId)!;
      if (!root) throw new ConflictException('Recipiente não encontrado.');
    }
    const container = o.containerEntityId
      ? byId.get(o.containerEntityId)!
      : null;
    const text = `${o.entity.name} está em ${o.place.entity.name}${container ? `, dentro de ${container.entity.name}` : ''}${root.carrier ? `, sob os cuidados de ${root.carrier.entity.name}` : ', sem portador'}.`;
    const latest = o.locationFact.revisions[0];
    if (latest?.text === text) continue;
    const fact = await tx.storyFact.update({
      where: { id: o.locationFact.id },
      data: { currentVersion: { increment: 1 } },
    });
    await tx.storyFactRevision.create({
      data: {
        campaignId,
        factId: fact.id,
        version: fact.currentVersion,
        text,
        sourceEventId: eventId,
        audienceId: latest.audienceId,
      },
    });
    if (o.portable)
      await tx.campaignPlotObject.update({
        where: { entityId: id },
        data: { state: text },
      });
  }
}

export async function initializeDomain(tx: Tx, campaignId: string) {
  const lore = await tx.campaignLore.findUniqueOrThrow({
    where: { campaignId },
    include: { packVersion: true },
  });
  if (lore.domainVersion === 1) return;
  if (!lore.storySequence)
    throw new ConflictException('Prepare a memória do cenário primeiro.');
  if (
    lore.packVersion.packKey !== 'eldoria-tres-sinos' ||
    !['1.0.0', '1.0.1'].includes(lore.packVersion.version)
  )
    throw new ConflictException(
      'Este pacote ainda não possui um perfil de comandos.',
    );
  const objects = await tx.campaignPlotObject.findMany({
    where: { campaignId },
    include: { entity: true, place: { include: { entity: true } } },
  });
  const box = objects.find((o) => o.entity.key === 'caixote');
  const clapper = objects.find((o) => o.entity.key === 'badajo');
  const c07 = await tx.storyFact.findUnique({
    where: { campaignId_key: { campaignId, key: 'C07' } },
  });
  // Do not guess containment or overwrite a world that evolved manually before MI-04.
  if (
    !box ||
    !clapper ||
    box.placeEntityId !== clapper.placeEntityId ||
    box.place.entity.key !== 'mina' ||
    box.containerEntityId ||
    clapper.containerEntityId ||
    box.carrierEntityId ||
    clapper.carrierEntityId ||
    !c07 ||
    c07.currentVersion !== 1
  )
    throw new ConflictException(
      'O estado do caixote/badajo ou C07 divergiu da premissa. Reconcilie a campanha antes de habilitar este perfil.',
    );
  const audience = await tx.storyAudience.create({
    data: { campaignId, scope: 'MASTER' },
  });
  const clock = await tx.campaignCalendar.findUniqueOrThrow({
    where: { campaignId },
  });
  const event = await tx.storyEvent.create({
    data: {
      campaignId,
      sequence: lore.storySequence + 1,
      kind: 'DOMAIN_INITIALIZED',
      actorKind: 'SYSTEM',
      actorName: 'Preparação de comandos',
      gameMinute: clock.totalMinutes,
      audienceId: audience.id,
      summary:
        'Comandos de grupo preparados; localizações vinculadas ao estado dos objetos.',
      payload: JSON.stringify({
        schemaVersion: 1,
        profile: 'ELDORIA_1',
        containment: { objectId: clapper.entityId, containerId: box.entityId },
      }),
    },
  });
  await tx.campaignPlotObject.update({
    where: { entityId: box.entityId },
    data: { portable: true },
  });
  await tx.campaignPlotObject.update({
    where: { entityId: clapper.entityId },
    data: { portable: true, containerEntityId: box.entityId },
  });
  for (const o of objects) {
    if (o.entityId === clapper.entityId) {
      await tx.storyFact.update({
        where: { id: c07.id },
        data: { predicate: 'OBJECT_LOCATION', boundObjectId: o.entityId },
      });
      continue;
    }
    const fact = await tx.storyFact.create({
      data: {
        campaignId,
        key: `LOC_${o.entity.key}`,
        predicate: 'OBJECT_LOCATION',
        boundObjectId: o.entityId,
        kind: 'FACT',
        classification: 'MUTABLE',
        subjects: { create: [{ entityId: o.entityId }] },
      },
    });
    const place = await tx.campaignEntity.findUniqueOrThrow({
      where: { id: o.placeEntityId },
    });
    await tx.storyFactRevision.create({
      data: {
        campaignId,
        factId: fact.id,
        version: 1,
        text: `${o.entity.name} está em ${place.name}, sem portador.`,
        audienceId: audience.id,
        sourceEventId: event.id,
      },
    });
  }
  await tx.campaignCalendar.update({
    where: { campaignId },
    data: { realMinutesPerTick: 0 },
  });
  await tx.campaignLore.update({
    where: { campaignId },
    data: {
      domainVersion: 1,
      revision: { increment: 1 },
      storySequence: { increment: 1 },
    },
  });
  await enqueueStory(tx, campaignId, event.id);
}
