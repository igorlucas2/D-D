-- AlterTable
ALTER TABLE `CombatParticipant` ADD COLUMN `actionUsed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `bonusUsed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reactionUsed` BOOLEAN NOT NULL DEFAULT false;
