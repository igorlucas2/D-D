-- Narracoes do mestre e diario com destinatarios (IM-06).
-- CreateTable
CREATE TABLE "JournalEntryRecipient" (
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("entryId", "userId"),
    CONSTRAINT "JournalEntryRecipient_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CampaignJournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NarrationDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "mapId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NarrationDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NarrationDraft_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "VttMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignJournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'SESSAO',
    "sessionDate" DATETIME,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignJournalEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CampaignJournalEntry" ("authorId", "campaignId", "category", "content", "createdAt", "id", "sessionDate", "title", "updatedAt") SELECT "authorId", "campaignId", "category", "content", "createdAt", "id", "sessionDate", "title", "updatedAt" FROM "CampaignJournalEntry";
DROP TABLE "CampaignJournalEntry";
ALTER TABLE "new_CampaignJournalEntry" RENAME TO "CampaignJournalEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "JournalEntryRecipient_userId_idx" ON "JournalEntryRecipient"("userId");

-- CreateIndex
CREATE INDEX "NarrationDraft_campaignId_idx" ON "NarrationDraft"("campaignId");

-- CreateIndex
CREATE INDEX "NarrationDraft_mapId_idx" ON "NarrationDraft"("mapId");

