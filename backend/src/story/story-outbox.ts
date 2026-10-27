import type { Prisma } from '@prisma/client';
export async function enqueueStory(
  tx: Prisma.TransactionClient,
  campaignId: string,
  eventId: string,
) {
  await tx.outboxEvent.create({ data: { campaignId, eventId } });
}
