-- Assistente do mestre com limite mensal (IM-12).
-- CreateTable
CREATE TABLE "AssistantRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "refused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssistantRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "masterId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "combatHpDisplay" TEXT NOT NULL DEFAULT 'DESCRIPTIVE',
    "assistantEnabled" BOOLEAN NOT NULL DEFAULT false,
    "assistantMonthlyLimit" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("combatHpDisplay", "createdAt", "description", "id", "inviteCode", "masterId", "name") SELECT "combatHpDisplay", "createdAt", "description", "id", "inviteCode", "masterId", "name" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE UNIQUE INDEX "Campaign_inviteCode_key" ON "Campaign"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AssistantRequest_campaignId_createdAt_idx" ON "AssistantRequest"("campaignId", "createdAt");

