-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VttMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 24,
    "height" INTEGER NOT NULL DEFAULT 16,
    "gridSize" INTEGER NOT NULL DEFAULT 1,
    "gridColor" TEXT NOT NULL DEFAULT '#94a3b8',
    "imageUrl" TEXT,
    "fogOfWarData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VttMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VttMap" ("campaignId", "createdAt", "fogOfWarData", "gridSize", "height", "id", "imageUrl", "name", "updatedAt", "width") SELECT "campaignId", "createdAt", "fogOfWarData", "gridSize", "height", "id", "imageUrl", "name", "updatedAt", "width" FROM "VttMap";
DROP TABLE "VttMap";
ALTER TABLE "new_VttMap" RENAME TO "VttMap";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
