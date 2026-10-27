-- Ultima visita de cada membro, para o resumo de retorno (IM-10).
-- AlterTable
ALTER TABLE "CampaignMember" ADD COLUMN "lastSeenAt" DATETIME;
ALTER TABLE "CampaignMember" ADD COLUMN "lastSeenGameMinutes" INTEGER;

