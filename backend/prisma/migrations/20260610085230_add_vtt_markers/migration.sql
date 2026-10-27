-- CreateTable
CREATE TABLE "VttMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#38bdf8',
    "note" TEXT,
    CONSTRAINT "VttMarker_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "VttMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
