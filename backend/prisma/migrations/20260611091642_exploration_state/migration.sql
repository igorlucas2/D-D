-- CreateTable
CREATE TABLE "CharacterExplorationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "currentMapId" TEXT,
    "actionPoints" INTEGER NOT NULL DEFAULT 6,
    "maxActionPoints" INTEGER NOT NULL DEFAULT 6,
    "fatigue" INTEGER NOT NULL DEFAULT 0,
    "lastRestAtMinutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterExplorationState_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterExplorationState_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterExplorationState_currentMapId_fkey" FOREIGN KEY ("currentMapId") REFERENCES "VttMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VttMapHotspot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'map-pin',
    "color" TEXT NOT NULL DEFAULT '#38bdf8',
    "targetMapId" TEXT,
    "visibleToPlayers" BOOLEAN NOT NULL DEFAULT true,
    "travelActionCost" INTEGER NOT NULL DEFAULT 1,
    "travelMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VttMapHotspot_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "VttMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VttMapHotspot_targetMapId_fkey" FOREIGN KEY ("targetMapId") REFERENCES "VttMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VttMapHotspot" ("color", "createdAt", "height", "icon", "id", "label", "mapId", "targetMapId", "updatedAt", "visibleToPlayers", "width", "x", "y") SELECT "color", "createdAt", "height", "icon", "id", "label", "mapId", "targetMapId", "updatedAt", "visibleToPlayers", "width", "x", "y" FROM "VttMapHotspot";
DROP TABLE "VttMapHotspot";
ALTER TABLE "new_VttMapHotspot" RENAME TO "VttMapHotspot";
CREATE UNIQUE INDEX "VttMapHotspot_targetMapId_key" ON "VttMapHotspot"("targetMapId");
CREATE INDEX "VttMapHotspot_mapId_idx" ON "VttMapHotspot"("mapId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CharacterExplorationState_characterId_key" ON "CharacterExplorationState"("characterId");

-- CreateIndex
CREATE INDEX "CharacterExplorationState_campaignId_idx" ON "CharacterExplorationState"("campaignId");

-- CreateIndex
CREATE INDEX "CharacterExplorationState_currentMapId_idx" ON "CharacterExplorationState"("currentMapId");
