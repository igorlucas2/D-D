-- AlterTable
ALTER TABLE `CampaignLore` ADD COLUMN `domainVersion` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `CampaignPlotObject` ADD COLUMN `carrierEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    ADD COLUMN `containerEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    ADD COLUMN `portable` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `StoryEvent` MODIFY `kind` ENUM('GENESIS', 'NOTE', 'FACT_CREATE', 'FACT_UPDATE', 'CORRECTION', 'DISCOVER', 'RELATIONSHIP', 'PROMISE_CREATE', 'PROMISE_RESOLVE', 'THREAD_UPDATE', 'DOMAIN_INITIALIZED', 'GROUP_TRAVEL', 'GROUP_REST', 'OBJECT_TAKEN', 'OBJECT_DROPPED', 'CLOCK_ADVANCED') NOT NULL;

-- AlterTable
ALTER TABLE `StoryFact` ADD COLUMN `boundObjectId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL;

-- CreateTable
CREATE TABLE `GameAction` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestedById` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `characterEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `requestKey` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `expectedSceneRevision` INTEGER NOT NULL,
    `originPlaceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `operation` LONGTEXT NOT NULL,
    `status` ENUM('PENDING', 'COMMITTED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `eventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `decisionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `GameAction_eventId_key`(`eventId`),
    INDEX `GameAction_campaignId_status_createdAt_idx`(`campaignId`, `status`, `createdAt`),
    UNIQUE INDEX `GameAction_campaignId_requestedById_requestKey_key`(`campaignId`, `requestedById`, `requestKey`),
    UNIQUE INDEX `GameAction_campaignId_eventId_key`(`campaignId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutboxEvent` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `eventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'DELIVERED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leaseToken` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `leaseUntil` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `lastError` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,

    UNIQUE INDEX `OutboxEvent_eventId_key`(`eventId`),
    INDEX `OutboxEvent_status_availableAt_idx`(`status`, `availableAt`),
    INDEX `OutboxEvent_status_leaseUntil_idx`(`status`, `leaseUntil`),
    UNIQUE INDEX `OutboxEvent_campaignId_eventId_key`(`campaignId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `StoryFact_boundObjectId_key` ON `StoryFact`(`boundObjectId`);

-- CreateIndex
CREATE UNIQUE INDEX `StoryFact_campaignId_boundObjectId_key` ON `StoryFact`(`campaignId`, `boundObjectId`);

-- AddForeignKey
ALTER TABLE `CampaignPlotObject` ADD CONSTRAINT `CampaignPlotObject_campaignId_containerEntityId_fkey` FOREIGN KEY (`campaignId`, `containerEntityId`) REFERENCES `CampaignPlotObject`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CampaignPlotObject` ADD CONSTRAINT `CampaignPlotObject_campaignId_carrierEntityId_fkey` FOREIGN KEY (`campaignId`, `carrierEntityId`) REFERENCES `CampaignCharacter`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryFact` ADD CONSTRAINT `StoryFact_campaignId_boundObjectId_fkey` FOREIGN KEY (`campaignId`, `boundObjectId`) REFERENCES `CampaignPlotObject`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GameAction` ADD CONSTRAINT `GameAction_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameAction` ADD CONSTRAINT `GameAction_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameAction` ADD CONSTRAINT `GameAction_campaignId_originPlaceId_fkey` FOREIGN KEY (`campaignId`, `originPlaceId`) REFERENCES `CampaignPlace`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GameAction` ADD CONSTRAINT `GameAction_campaignId_characterEntityId_fkey` FOREIGN KEY (`campaignId`, `characterEntityId`) REFERENCES `CampaignCharacter`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GameAction` ADD CONSTRAINT `GameAction_campaignId_eventId_fkey` FOREIGN KEY (`campaignId`, `eventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `OutboxEvent` ADD CONSTRAINT `OutboxEvent_campaignId_eventId_fkey` FOREIGN KEY (`campaignId`, `eventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

