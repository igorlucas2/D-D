import type { Prisma } from '@prisma/client';
import { deleteCampaignStory } from '../story/delete-story';

// Explicit dependency order for restrictive, campaign-scoped foreign keys.
export async function deleteCampaignLore(
  tx: Prisma.TransactionClient,
  campaignId: string,
) {
  if (!(await tx.campaignLore.findUnique({ where: { campaignId } }))) return;
  await deleteCampaignStory(tx, campaignId);
  await tx.campaignPlotObject.updateMany({
    where: { campaignId },
    data: { containerEntityId: null, carrierEntityId: null },
  });
  await tx.campaignCharacter.deleteMany({ where: { campaignId } });
  await tx.sceneState.deleteMany({ where: { campaignId } });
  await tx.travelRoute.deleteMany({ where: { campaignId } });
  await tx.campaignNpc.deleteMany({ where: { campaignId } });
  await tx.campaignPlotObject.deleteMany({ where: { campaignId } });
  await tx.campaignPlace.updateMany({
    where: { campaignId },
    data: { parentEntityId: null },
  });
  await tx.campaignPlace.deleteMany({ where: { campaignId } });
  await tx.campaignFaction.deleteMany({ where: { campaignId } });
  await tx.campaignEntity.deleteMany({ where: { campaignId } });
  await tx.campaignLoreMap.deleteMany({ where: { campaignId } });
  await tx.campaignLore.delete({ where: { campaignId } });
}
