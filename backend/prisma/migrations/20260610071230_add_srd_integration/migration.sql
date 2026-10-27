-- AlterTable
ALTER TABLE "Item" ADD COLUMN "source" TEXT;
ALTER TABLE "Item" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Item" ADD COLUMN "srdIndex" TEXT;
ALTER TABLE "Item" ADD COLUMN "srdUpdatedAt" DATETIME;

-- AlterTable
ALTER TABLE "Monster" ADD COLUMN "source" TEXT;
ALTER TABLE "Monster" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Monster" ADD COLUMN "srdIndex" TEXT;
ALTER TABLE "Monster" ADD COLUMN "srdUpdatedAt" DATETIME;

-- AlterTable
ALTER TABLE "Spell" ADD COLUMN "source" TEXT;
ALTER TABLE "Spell" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Spell" ADD COLUMN "srdIndex" TEXT;
ALTER TABLE "Spell" ADD COLUMN "srdUpdatedAt" DATETIME;

-- CreateTable
CREATE TABLE "SrdResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "index" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'dnd5eapi-2014',
    "data" TEXT NOT NULL,
    "srdUpdatedAt" DATETIME,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SrdResource_endpoint_idx" ON "SrdResource"("endpoint");

-- CreateIndex
CREATE INDEX "SrdResource_name_idx" ON "SrdResource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SrdResource_endpoint_index_key" ON "SrdResource"("endpoint", "index");
