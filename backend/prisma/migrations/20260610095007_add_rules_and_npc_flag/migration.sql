-- CreateTable
CREATE TABLE "RuleSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "srdIndex" TEXT,
    "sourceUrl" TEXT,
    "source" TEXT,
    "srdUpdatedAt" DATETIME,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Monster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "srdIndex" TEXT,
    "sourceUrl" TEXT,
    "source" TEXT,
    "srdUpdatedAt" DATETIME,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "armorClass" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL DEFAULT 9,
    "strength" INTEGER NOT NULL DEFAULT 10,
    "dexterity" INTEGER NOT NULL DEFAULT 10,
    "constitution" INTEGER NOT NULL DEFAULT 10,
    "intelligence" INTEGER NOT NULL DEFAULT 10,
    "wisdom" INTEGER NOT NULL DEFAULT 10,
    "charisma" INTEGER NOT NULL DEFAULT 10,
    "challengeRating" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "traits" TEXT,
    "actions" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "isNpc" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Monster" ("actions", "armorClass", "challengeRating", "charisma", "constitution", "description", "dexterity", "id", "imageUrl", "intelligence", "maxHp", "name", "size", "source", "sourceUrl", "speed", "srdIndex", "srdUpdatedAt", "strength", "traits", "type", "wisdom", "xp") SELECT "actions", "armorClass", "challengeRating", "charisma", "constitution", "description", "dexterity", "id", "imageUrl", "intelligence", "maxHp", "name", "size", "source", "sourceUrl", "speed", "srdIndex", "srdUpdatedAt", "strength", "traits", "type", "wisdom", "xp" FROM "Monster";
DROP TABLE "Monster";
ALTER TABLE "new_Monster" RENAME TO "Monster";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RuleSection_srdIndex_key" ON "RuleSection"("srdIndex");
