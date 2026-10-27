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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCalendar_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CampaignCalendar" ("campaignId", "currentDay", "currentMonth", "currentYear", "daysPerMonth", "id", "monthNames", "notes", "updatedAt", "weekdayNames") SELECT "campaignId", "currentDay", "currentMonth", "currentYear", "daysPerMonth", "id", "monthNames", "notes", "updatedAt", "weekdayNames" FROM "CampaignCalendar";
DROP TABLE "CampaignCalendar";
ALTER TABLE "new_CampaignCalendar" RENAME TO "CampaignCalendar";
CREATE UNIQUE INDEX "CampaignCalendar_campaignId_key" ON "CampaignCalendar"("campaignId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
