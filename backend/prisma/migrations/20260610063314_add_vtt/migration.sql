-- CreateTable
CREATE TABLE "VttMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 24,
    "height" INTEGER NOT NULL DEFAULT 16,
    "gridSize" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "fogOfWarData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VttMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VttToken" (
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
    CONSTRAINT "VttToken_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "VttMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VttToken_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
