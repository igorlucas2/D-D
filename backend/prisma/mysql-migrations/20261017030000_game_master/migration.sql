-- AlterTable
ALTER TABLE `CampaignLore` ADD COLUMN `aiEpoch` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `aiPaused` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `GameMasterTurn` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestedById` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestKey` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `kind` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `prompt` TEXT NOT NULL,
    `focusEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `expectedRevision` INTEGER NOT NULL,
    `sceneRevision` INTEGER NOT NULL,
    `epoch` INTEGER NOT NULL,
    `status` ENUM('REQUESTED', 'GENERATING', 'READY', 'FAILED', 'STALE', 'CANCELLED', 'COMMITTED') NOT NULL DEFAULT 'REQUESTED',
    `context` LONGTEXT NOT NULL,
    `proposal` LONGTEXT NULL,
    `reviewedText` TEXT NULL,
    `resultEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `errorCode` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `model` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `latencyMs` INTEGER NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `leaseToken` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `leaseUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `GameMasterTurn_resultEventId_key`(`resultEventId`),
    INDEX `GameMasterTurn_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `GameMasterTurn_status_leaseUntil_idx`(`status`, `leaseUntil`),
    UNIQUE INDEX `GameMasterTurn_campaignId_requestKey_key`(`campaignId`, `requestKey`),
    UNIQUE INDEX `GameMasterTurn_campaignId_resultEventId_key`(`campaignId`, `resultEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GameMasterTurn` ADD CONSTRAINT `GameMasterTurn_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameMasterTurn` ADD CONSTRAINT `GameMasterTurn_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameMasterTurn` ADD CONSTRAINT `GameMasterTurn_campaignId_focusEntityId_fkey` FOREIGN KEY (`campaignId`, `focusEntityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GameMasterTurn` ADD CONSTRAINT `GameMasterTurn_campaignId_resultEventId_fkey` FOREIGN KEY (`campaignId`, `resultEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

