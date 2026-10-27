-- CreateTable
CREATE TABLE "CombatEncounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Combate',
    "round" INTEGER NOT NULL DEFAULT 1,
    "turnIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CombatEncounter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombatParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "characterId" TEXT,
    "name" TEXT NOT NULL,
    "initiative" INTEGER NOT NULL DEFAULT 0,
    "maxHp" INTEGER NOT NULL DEFAULT 1,
    "currentHp" INTEGER NOT NULL DEFAULT 1,
    "conditions" TEXT,
    "isAlly" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CombatParticipant_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "CombatEncounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CombatParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CombatEncounter_campaignId_key" ON "CombatEncounter"("campaignId");
