-- AlterTable
ALTER TABLE `CampaignLore` ADD COLUMN `storySequence` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `StoryAudience` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `scope` ENUM('MASTER', 'PUBLIC', 'RECIPIENTS') NOT NULL,

    UNIQUE INDEX `StoryAudience_campaignId_id_key`(`campaignId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryAudienceMember` (
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `audienceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    INDEX `StoryAudienceMember_userId_idx`(`userId`),
    PRIMARY KEY (`audienceId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryEvent` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `sequence` INTEGER NOT NULL,
    `kind` ENUM('GENESIS', 'NOTE', 'FACT_CREATE', 'FACT_UPDATE', 'CORRECTION', 'DISCOVER', 'RELATIONSHIP', 'PROMISE_CREATE', 'PROMISE_RESOLVE', 'THREAD_UPDATE') NOT NULL,
    `gameMinute` INTEGER NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorKind` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `actorUserId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `actorName` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestKey` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `requestHash` CHAR(64) NULL,
    `audienceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `summary` TEXT NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `correctsEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,

    INDEX `StoryEvent_campaignId_gameMinute_idx`(`campaignId`, `gameMinute`),
    UNIQUE INDEX `StoryEvent_campaignId_id_key`(`campaignId`, `id`),
    UNIQUE INDEX `StoryEvent_campaignId_sequence_key`(`campaignId`, `sequence`),
    UNIQUE INDEX `StoryEvent_campaignId_requestKey_key`(`campaignId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventEntity` (
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `eventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `entityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    INDEX `EventEntity_entityId_eventId_idx`(`entityId`, `eventId`),
    PRIMARY KEY (`eventId`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryFact` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `kind` ENUM('FACT', 'CLAIM') NOT NULL,
    `classification` ENUM('FIXED', 'MUTABLE') NOT NULL,
    `predicate` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'ASSERTION',
    `currentVersion` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `StoryFact_campaignId_id_key`(`campaignId`, `id`),
    UNIQUE INDEX `StoryFact_campaignId_key_key`(`campaignId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryFactSubject` (
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `factId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `entityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    INDEX `StoryFactSubject_entityId_idx`(`entityId`),
    PRIMARY KEY (`factId`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryFactRevision` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `factId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `version` INTEGER NOT NULL,
    `text` LONGTEXT NOT NULL,
    `evaluation` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `sourceEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `audienceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    UNIQUE INDEX `StoryFactRevision_campaignId_id_key`(`campaignId`, `id`),
    UNIQUE INDEX `StoryFactRevision_factId_version_key`(`factId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntityKnowledge` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `knowerEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `factRevisionId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `stance` ENUM('KNOWN', 'BELIEVED', 'SUSPECTED') NOT NULL,
    `source` TEXT NOT NULL,
    `sourceEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    INDEX `EntityKnowledge_knowerEntityId_factRevisionId_idx`(`knowerEntityId`, `factRevisionId`),
    UNIQUE INDEX `EntityKnowledge_campaignId_knowerEntityId_factRevisionId_sou_key`(`campaignId`, `knowerEntityId`, `factRevisionId`, `sourceEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryRelationship` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `fromEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `toEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `trust` INTEGER NOT NULL DEFAULT 0,
    `fear` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NOT NULL,
    `audienceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `sourceEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    UNIQUE INDEX `StoryRelationship_campaignId_fromEntityId_toEntityId_key`(`campaignId`, `fromEntityId`, `toEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryPromise` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `giverEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `receiverEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `terms` TEXT NOT NULL,
    `status` ENUM('OPEN', 'FULFILLED', 'BROKEN', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `resolution` TEXT NULL,
    `audienceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `sourceEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    INDEX `StoryPromise_campaignId_status_idx`(`campaignId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryThread` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `objective` TEXT NOT NULL,
    `completion` TEXT NOT NULL,
    `consequence` TEXT NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'ABANDONED') NOT NULL DEFAULT 'OPEN',
    `resolution` TEXT NULL,
    `audienceId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `sourceEventId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,

    UNIQUE INDEX `StoryThread_campaignId_key_key`(`campaignId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StoryAudience` ADD CONSTRAINT `StoryAudience_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryAudienceMember` ADD CONSTRAINT `StoryAudienceMember_campaignId_audienceId_fkey` FOREIGN KEY (`campaignId`, `audienceId`) REFERENCES `StoryAudience`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryAudienceMember` ADD CONSTRAINT `StoryAudienceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryEvent` ADD CONSTRAINT `StoryEvent_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryEvent` ADD CONSTRAINT `StoryEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryEvent` ADD CONSTRAINT `StoryEvent_campaignId_audienceId_fkey` FOREIGN KEY (`campaignId`, `audienceId`) REFERENCES `StoryAudience`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryEvent` ADD CONSTRAINT `StoryEvent_campaignId_correctsEventId_fkey` FOREIGN KEY (`campaignId`, `correctsEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `EventEntity` ADD CONSTRAINT `EventEntity_campaignId_eventId_fkey` FOREIGN KEY (`campaignId`, `eventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventEntity` ADD CONSTRAINT `EventEntity_campaignId_entityId_fkey` FOREIGN KEY (`campaignId`, `entityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryFact` ADD CONSTRAINT `StoryFact_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryFactSubject` ADD CONSTRAINT `StoryFactSubject_campaignId_factId_fkey` FOREIGN KEY (`campaignId`, `factId`) REFERENCES `StoryFact`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryFactSubject` ADD CONSTRAINT `StoryFactSubject_campaignId_entityId_fkey` FOREIGN KEY (`campaignId`, `entityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryFactRevision` ADD CONSTRAINT `StoryFactRevision_campaignId_factId_fkey` FOREIGN KEY (`campaignId`, `factId`) REFERENCES `StoryFact`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryFactRevision` ADD CONSTRAINT `StoryFactRevision_campaignId_sourceEventId_fkey` FOREIGN KEY (`campaignId`, `sourceEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryFactRevision` ADD CONSTRAINT `StoryFactRevision_campaignId_audienceId_fkey` FOREIGN KEY (`campaignId`, `audienceId`) REFERENCES `StoryAudience`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `EntityKnowledge` ADD CONSTRAINT `EntityKnowledge_campaignId_knowerEntityId_fkey` FOREIGN KEY (`campaignId`, `knowerEntityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `EntityKnowledge` ADD CONSTRAINT `EntityKnowledge_campaignId_factRevisionId_fkey` FOREIGN KEY (`campaignId`, `factRevisionId`) REFERENCES `StoryFactRevision`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `EntityKnowledge` ADD CONSTRAINT `EntityKnowledge_campaignId_sourceEventId_fkey` FOREIGN KEY (`campaignId`, `sourceEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryRelationship` ADD CONSTRAINT `StoryRelationship_campaignId_fromEntityId_fkey` FOREIGN KEY (`campaignId`, `fromEntityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryRelationship` ADD CONSTRAINT `StoryRelationship_campaignId_toEntityId_fkey` FOREIGN KEY (`campaignId`, `toEntityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryRelationship` ADD CONSTRAINT `StoryRelationship_campaignId_audienceId_fkey` FOREIGN KEY (`campaignId`, `audienceId`) REFERENCES `StoryAudience`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryRelationship` ADD CONSTRAINT `StoryRelationship_campaignId_sourceEventId_fkey` FOREIGN KEY (`campaignId`, `sourceEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryPromise` ADD CONSTRAINT `StoryPromise_campaignId_giverEntityId_fkey` FOREIGN KEY (`campaignId`, `giverEntityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryPromise` ADD CONSTRAINT `StoryPromise_campaignId_receiverEntityId_fkey` FOREIGN KEY (`campaignId`, `receiverEntityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryPromise` ADD CONSTRAINT `StoryPromise_campaignId_audienceId_fkey` FOREIGN KEY (`campaignId`, `audienceId`) REFERENCES `StoryAudience`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryPromise` ADD CONSTRAINT `StoryPromise_campaignId_sourceEventId_fkey` FOREIGN KEY (`campaignId`, `sourceEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryThread` ADD CONSTRAINT `StoryThread_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryThread` ADD CONSTRAINT `StoryThread_campaignId_audienceId_fkey` FOREIGN KEY (`campaignId`, `audienceId`) REFERENCES `StoryAudience`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `StoryThread` ADD CONSTRAINT `StoryThread_campaignId_sourceEventId_fkey` FOREIGN KEY (`campaignId`, `sourceEventId`) REFERENCES `StoryEvent`(`campaignId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

