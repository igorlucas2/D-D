-- AlterTable
ALTER TABLE `CombatParticipant` ADD COLUMN `tempHp` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `CombatAction` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `encounterId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `requestKey` VARCHAR(191) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `targetKind` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `targetName` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `result` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CombatAction_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
    INDEX `CombatAction_encounterId_createdAt_idx`(`encounterId`, `createdAt`),
    UNIQUE INDEX `CombatAction_campaignId_actorUserId_requestKey_key`(`campaignId`, `actorUserId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

-- AddForeignKey
ALTER TABLE `CombatAction` ADD CONSTRAINT `CombatAction_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombatAction` ADD CONSTRAINT `CombatAction_encounterId_fkey` FOREIGN KEY (`encounterId`) REFERENCES `CombatEncounter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombatAction` ADD CONSTRAINT `CombatAction_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
