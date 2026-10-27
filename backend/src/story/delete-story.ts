import type { Prisma } from '@prisma/client';

// Only used by whole-campaign removal. No narrative endpoint deletes history.
export async function deleteCampaignStory(
  tx: Prisma.TransactionClient,
  campaignId: string,
) {
  await tx.campaignNpc.updateMany({
    where: { campaignId },
    data: { activeJourneyId: null },
  });
  await tx.scheduledConsequence.updateMany({
    where: { campaignId },
    data: { parentId: null },
  });
  await tx.scheduledConsequence.deleteMany({ where: { campaignId } });
  await tx.worldAutomationPolicy.deleteMany({ where: { campaignId } });
  // Whole-campaign deletion only: detach the conversation tree before removing it.
  await tx.gameMasterTurn.updateMany({
    where: { campaignId, parentTurnId: { not: null } },
    data: { parentTurnId: null },
  });
  await tx.gameMasterTurn.deleteMany({ where: { campaignId } });
  await tx.gameAction.deleteMany({ where: { campaignId } });
  await tx.entityKnowledge.deleteMany({ where: { campaignId } });
  await tx.storyRelationship.deleteMany({ where: { campaignId } });
  await tx.storyPromise.deleteMany({ where: { campaignId } });
  await tx.storyThread.deleteMany({ where: { campaignId } });
  await tx.storyFact.deleteMany({ where: { campaignId } });
  const events = await tx.storyEvent.findMany({
    where: { campaignId },
    orderBy: { sequence: 'desc' },
    select: { id: true },
  });
  // Corrections point backwards. Restrictive references stay enabled throughout.
  for (const event of events)
    await tx.storyEvent.delete({ where: { id: event.id } });
  await tx.storyAudience.deleteMany({ where: { campaignId } });
}
