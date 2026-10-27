-- CreateTable
CREATE TABLE "CampaignWorldEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignWorldEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignWorldEntry_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CampaignWorldEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "monthNames" TEXT NOT NULL,
    "daysPerMonth" TEXT NOT NULL,
    "weekdayNames" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "currentMonth" INTEGER NOT NULL DEFAULT 1,
    "currentYear" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCalendar_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignWorldEntry_campaignId_idx" ON "CampaignWorldEntry"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignWorldEntry_parentId_idx" ON "CampaignWorldEntry"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCalendar_campaignId_key" ON "CampaignCalendar"("campaignId");
