-- AlterTable
ALTER TABLE `CampaignNpc` ADD COLUMN `activeJourneyId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL;

-- AlterTable
ALTER TABLE `StoryEvent` MODIFY `kind` ENUM('GENESIS', 'NOTE', 'FACT_CREATE', 'FACT_UPDATE', 'CORRECTION', 'DISCOVER', 'RELATIONSHIP', 'PROMISE_CREATE', 'PROMISE_RESOLVE', 'THREAD_UPDATE', 'DOMAIN_INITIALIZED', 'GROUP_TRAVEL', 'GROUP_REST', 'OBJECT_TAKEN', 'OBJECT_DROPPED', 'CLOCK_ADVANCED', 'AUTOMATION_CONFIGURED', 'CONSEQUENCE_SCHEDULED', 'CONSEQUENCE_CANCELLED', 'SCHEDULED_NOTICE', 'NPC_DEPARTED', 'NPC_ARRIVED') NOT NULL;

-- CreateTable
CREATE TABLE `WorldAutomationPolicy` (
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `paused` BOOLEAN NOT NULL DEFAULT false,
    `allowNpcTravel` BOOLEAN NOT NULL DEFAULT false,
    `maxPerAdvance` INTEGER NOT NULL DEFAULT 4,
    `configuredById` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`campaignId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduledConsequence` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestKey` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `createdById` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `kind` ENUM('REMINDER', 'NPC_DEPART', 'NPC_ARRIVE') NOT NULL,
    `title` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `text` TEXT NOT NULL,
    `dueMinute` INTEGER NOT NULL,
    `autoApproved` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('SCHEDULED', 'WAITING_MASTER', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `npcEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `routeId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `travelMinutes` INTEGER NULL,
    `npcStateHash` CHAR(64) NULL,
    `parentId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `resultEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `reasonCode` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ScheduledConsequence_parentId_key`(`parentId`),
    UNIQUE INDEX `ScheduledConsequence_resultEventId_key`(`resultEventId`),
    INDEX `ScheduledConsequence_campaignId_status_dueMinute_idx`(`campaignId`, `status`, `dueMinute`),
    UNIQUE INDEX `ScheduledConsequence_campaignId_id_key`(`campaignId`, `id`),
    UNIQUE INDEX `ScheduledConsequence_campaignId_requestKey_key`(`campaignId`, `requestKey`),
    UNIQUE INDEX `ScheduledConsequence_campaignId_parentId_key`(`campaignId`, `parentId`),
    UNIQUE INDEX `ScheduledConsequence_campaignId_resultEventId_key`(`campaignId`, `resultEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `CampaignNpc_activeJourneyId_key` ON `CampaignNpc`(`activeJourneyId`);

-- CreateIndex
CREATE UNIQUE INDEX `CampaignNpc_campaignId_activeJourneyId_key` ON `CampaignNpc`(`campaignId`, `activeJourneyId`);

-- CreateIndex
CREATE UNIQUE INDEX `TravelRoute_campaignId_id_key` ON `TravelRoute`(`campaignId`, `id`);

-- AddForeignKey
ALTER TABLE `CampaignNpc` ADD CONSTRAINT `CampaignNpc_campaignId_activeJourneyId_fkey` FOREIGN KEY (`campaignId`, `activeJourneyId`) REFERENCES `ScheduledConsequence`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `WorldAutomationPolicy` ADD CONSTRAINT `WorldAutomationPolicy_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorldAutomationPolicy` ADD CONSTRAINT `WorldAutomationPolicy_configuredById_fkey` FOREIGN KEY (`configuredById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledConsequence` ADD CONSTRAINT `ScheduledConsequence_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledConsequence` ADD CONSTRAINT `ScheduledConsequence_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledConsequence` ADD CONSTRAINT `ScheduledConsequence_campaignId_npcEntityId_fkey` FOREIGN KEY (`campaignId`, `npcEntityId`) REFERENCES `CampaignNpc`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ScheduledConsequence` ADD CONSTRAINT `ScheduledConsequence_campaignId_routeId_fkey` FOREIGN KEY (`campaignId`, `routeId`) REFERENCES `TravelRoute`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ScheduledConsequence` ADD CONSTRAINT `ScheduledConsequence_campaignId_parentId_fkey` FOREIGN KEY (`campaignId`, `parentId`) REFERENCES `ScheduledConsequence`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ScheduledConsequence` ADD CONSTRAINT `ScheduledConsequence_campaignId_resultEventId_fkey` FOREIGN KEY (`campaignId`, `resultEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

