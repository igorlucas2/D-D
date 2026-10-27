import type { GameMasterTurn, Prisma } from '@prisma/client';

// Rechecked before inference, after inference and before publishing a reply.
export async function intentIsCurrent(
  tx: Prisma.TransactionClient,
  turn: Pick<
    GameMasterTurn,
    | 'campaignId'
    | 'requestedById'
    | 'playerEntityId'
    | 'sceneRevision'
    | 'focusEntityId'
  >,
) {
  const campaign = await tx.campaign.findUnique({
    where: { id: turn.campaignId },
    include: { members: true },
  });
  if (
    !campaign ||
    (campaign.masterId !== turn.requestedById &&
      !campaign.members.some((m) => m.userId === turn.requestedById))
  )
    return false;
  const scene = await tx.sceneState.findUnique({
    where: { campaignId: turn.campaignId },
  });
  if (!scene || scene.revision !== turn.sceneRevision) return false;
  const character = await tx.campaignCharacter.findFirst({
    where: {
      campaignId: turn.campaignId,
      entityId: turn.playerEntityId!,
      character: { userId: turn.requestedById },
    },
  });
  if (!character) return false;
  if (
    turn.focusEntityId &&
    !(await tx.campaignNpc.findFirst({
      where: {
        campaignId: turn.campaignId,
        entityId: turn.focusEntityId,
        placeEntityId: scene.placeEntityId,
        activeJourneyId: null,
      },
    }))
  )
    return false;
  return true;
}
