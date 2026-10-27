-- CreateTable
CREATE TABLE "CampaignWorldEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'EVENTO',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignWorldEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "monthNames" TEXT NOT NULL,
    "daysPerMonth" TEXT NOT NULL,
    "weekdayNames" TEXT NOT NULL,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "currentMonth" INTEGER NOT NULL DEFAULT 1,
    "currentYear" INTEGER NOT NULL DEFAULT 1,
    "currentHour" INTEGER NOT NULL DEFAULT 8,
    "currentMinute" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "realMinutesPerTick" INTEGER NOT NULL DEFAULT 0,
    "gameMinutesPerTick" INTEGER NOT NULL DEFAULT 60,
    "eventChancePercent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCalendar_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CampaignCalendar" ("campaignId", "currentDay", "currentHour", "currentMinute", "currentMonth", "currentYear", "daysPerMonth", "gameMinutesPerTick", "id", "monthNames", "notes", "realMinutesPerTick", "totalMinutes", "updatedAt", "weekdayNames") SELECT "campaignId", "currentDay", "currentHour", "currentMinute", "currentMonth", "currentYear", "daysPerMonth", "gameMinutesPerTick", "id", "monthNames", "notes", "realMinutesPerTick", "totalMinutes", "updatedAt", "weekdayNames" FROM "CampaignCalendar";
DROP TABLE "CampaignCalendar";
ALTER TABLE "new_CampaignCalendar" RENAME TO "CampaignCalendar";
CREATE UNIQUE INDEX "CampaignCalendar_campaignId_key" ON "CampaignCalendar"("campaignId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CampaignWorldEvent_campaignId_idx" ON "CampaignWorldEvent"("campaignId");
