-- AlterTable
ALTER TABLE `VttMap` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `CombatEncounter` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `CampaignCalendar` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastTickAt` DATETIME(3) NULL;
