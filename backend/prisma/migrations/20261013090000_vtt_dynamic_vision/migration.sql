-- Visao dinamica: paredes, portas, luz e visao no escuro por token (IM-13).
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
    "published" BOOLEAN NOT NULL DEFAULT false,
    "lightingMode" TEXT NOT NULL DEFAULT 'AUTO',
    "vision" TEXT NOT NULL DEFAULT 'OFF',
    "wallsData" TEXT,
    "ambiencePreset" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VttMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VttMap_parentMapId_fkey" FOREIGN KEY ("parentMapId") REFERENCES "VttMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VttMap" ("ambiencePreset", "campaignId", "createdAt", "fogOfWarData", "gridColor", "gridSize", "height", "id", "imageUrl", "kind", "lightingMode", "name", "parentMapId", "published", "updatedAt", "width") SELECT "ambiencePreset", "campaignId", "createdAt", "fogOfWarData", "gridColor", "gridSize", "height", "id", "imageUrl", "kind", "lightingMode", "name", "parentMapId", "published", "updatedAt", "width" FROM "VttMap";
DROP TABLE "VttMap";
ALTER TABLE "new_VttMap" RENAME TO "VttMap";
CREATE INDEX "VttMap_parentMapId_idx" ON "VttMap"("parentMapId");
CREATE TABLE "new_VttToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "characterId" TEXT,
    "name" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "imageUrl" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "lightRadius" INTEGER NOT NULL DEFAULT 0,
    "visionRadius" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "VttToken_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "VttMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VttToken_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VttToken" ("characterId", "color", "id", "imageUrl", "mapId", "name", "size", "visible", "x", "y") SELECT "characterId", "color", "id", "imageUrl", "mapId", "name", "size", "visible", "x", "y" FROM "VttToken";
DROP TABLE "VttToken";
ALTER TABLE "new_VttToken" RENAME TO "VttToken";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

