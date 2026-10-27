-- CreateTable
CREATE TABLE "VttMapHotspot" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VttMapHotspot_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "VttMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VttMapHotspot_targetMapId_fkey" FOREIGN KEY ("targetMapId") REFERENCES "VttMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VttMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "parentMapId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 24,
    "height" INTEGER NOT NULL DEFAULT 16,
    "gridSize" INTEGER NOT NULL DEFAULT 1,
    "gridColor" TEXT NOT NULL DEFAULT '#94a3b8',
    "imageUrl" TEXT,
    "fogOfWarData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VttMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VttMap_parentMapId_fkey" FOREIGN KEY ("parentMapId") REFERENCES "VttMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VttMap" ("campaignId", "createdAt", "fogOfWarData", "gridColor", "gridSize", "height", "id", "imageUrl", "name", "updatedAt", "width") SELECT "campaignId", "createdAt", "fogOfWarData", "gridColor", "gridSize", "height", "id", "imageUrl", "name", "updatedAt", "width" FROM "VttMap";
DROP TABLE "VttMap";
ALTER TABLE "new_VttMap" RENAME TO "VttMap";
CREATE INDEX "VttMap_parentMapId_idx" ON "VttMap"("parentMapId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VttMapHotspot_targetMapId_key" ON "VttMapHotspot"("targetMapId");

-- CreateIndex
CREATE INDEX "VttMapHotspot_mapId_idx" ON "VttMapHotspot"("mapId");
