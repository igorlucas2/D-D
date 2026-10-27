-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "description" TEXT
);
