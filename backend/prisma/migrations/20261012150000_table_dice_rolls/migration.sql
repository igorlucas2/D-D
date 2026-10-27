-- Rolagens na mesa com visibilidade por destinatario (IM-04).
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DiceRoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "characterId" TEXT,
    "campaignId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "formula" TEXT NOT NULL,
    "result" INTEGER NOT NULL,
    "breakdown" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiceRoll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiceRoll_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DiceRoll_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DiceRoll" ("breakdown", "characterId", "createdAt", "formula", "id", "result", "userId") SELECT "breakdown", "characterId", "createdAt", "formula", "id", "result", "userId" FROM "DiceRoll";
DROP TABLE "DiceRoll";
ALTER TABLE "new_DiceRoll" RENAME TO "DiceRoll";
CREATE INDEX "DiceRoll_campaignId_createdAt_idx" ON "DiceRoll"("campaignId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

