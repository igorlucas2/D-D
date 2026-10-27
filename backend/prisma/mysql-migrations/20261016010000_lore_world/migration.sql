-- CreateTable
CREATE TABLE `LorePackVersion` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `packKey` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `version` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `contentHash` CHAR(64) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `formatVersion` INTEGER NOT NULL,
    `snapshot` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LorePackVersion_packKey_version_key`(`packKey`, `version`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignLore` (
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `packVersionId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `installedById` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `requestKey` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `requestHash` CHAR(64) NULL,
    `installedHash` CHAR(64) NOT NULL,
    `catalogSnapshots` LONGTEXT NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'OFF',
    `playtest` BOOLEAN NOT NULL DEFAULT false,
    `installedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CampaignLore_installedById_requestKey_key`(`installedById`, `requestKey`),
    PRIMARY KEY (`campaignId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignEntity` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `kind` ENUM('PLACE', 'NPC', 'FACTION', 'OBJECT', 'CHARACTER') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `templateKey` VARCHAR(191) NULL,

    UNIQUE INDEX `CampaignEntity_campaignId_key_key`(`campaignId`, `key`),
    UNIQUE INDEX `CampaignEntity_campaignId_id_key`(`campaignId`, `id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignLoreMap` (
    `mapId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `textureHash` CHAR(64) NOT NULL,
    `texture` MEDIUMBLOB NOT NULL,

    UNIQUE INDEX `CampaignLoreMap_campaignId_mapId_key`(`campaignId`, `mapId`),
    UNIQUE INDEX `CampaignLoreMap_campaignId_key_key`(`campaignId`, `key`),
    PRIMARY KEY (`mapId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignPlace` (
    `entityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `parentEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `mapId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `description` LONGTEXT NOT NULL,

    UNIQUE INDEX `CampaignPlace_campaignId_entityId_key`(`campaignId`, `entityId`),
    PRIMARY KEY (`entityId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignFaction` (
    `entityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `objective` LONGTEXT NOT NULL,
    `limits` LONGTEXT NOT NULL,

    UNIQUE INDEX `CampaignFaction_campaignId_entityId_key`(`campaignId`, `entityId`),
    PRIMARY KEY (`entityId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignNpc` (
    `entityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `placeEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `factionEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    `catalogSource` VARCHAR(191) NOT NULL,
    `catalogIndex` VARCHAR(191) NOT NULL,
    `catalogSnapshot` LONGTEXT NOT NULL,
    `objective` LONGTEXT NOT NULL,
    `voice` LONGTEXT NOT NULL,
    `maxHp` INTEGER NOT NULL,
    `currentHp` INTEGER NOT NULL,
    `conditions` LONGTEXT NOT NULL,

    UNIQUE INDEX `CampaignNpc_campaignId_entityId_key`(`campaignId`, `entityId`),
    PRIMARY KEY (`entityId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignPlotObject` (
    `entityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `placeEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `state` LONGTEXT NOT NULL,

    UNIQUE INDEX `CampaignPlotObject_campaignId_entityId_key`(`campaignId`, `entityId`),
    PRIMARY KEY (`entityId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TravelRoute` (
    `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `fromEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `toEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `minutes` INTEGER NOT NULL,
    `blocked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `TravelRoute_campaignId_fromEntityId_toEntityId_key`(`campaignId`, `fromEntityId`, `toEntityId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SceneState` (
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `placeEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `phase` VARCHAR(191) NOT NULL DEFAULT 'EXPLORATION',

    PRIMARY KEY (`campaignId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignCharacter` (
    `entityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CampaignCharacter_characterId_key`(`characterId`),
    UNIQUE INDEX `CampaignCharacter_campaignId_entityId_key`(`campaignId`, `entityId`),
    PRIMARY KEY (`entityId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `VttMap_campaignId_id_key` ON `VttMap`(`campaignId`, `id`);

-- AddForeignKey
ALTER TABLE `CampaignLore` ADD CONSTRAINT `CampaignLore_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignLore` ADD CONSTRAINT `CampaignLore_packVersionId_fkey` FOREIGN KEY (`packVersionId`) REFERENCES `LorePackVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignLore` ADD CONSTRAINT `CampaignLore_installedById_fkey` FOREIGN KEY (`installedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignEntity` ADD CONSTRAINT `CampaignEntity_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignLoreMap` ADD CONSTRAINT `CampaignLoreMap_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignLoreMap` ADD CONSTRAINT `CampaignLoreMap_campaignId_mapId_fkey` FOREIGN KEY (`campaignId`, `mapId`) REFERENCES `VttMap`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignPlace` ADD CONSTRAINT `CampaignPlace_campaignId_entityId_fkey` FOREIGN KEY (`campaignId`, `entityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignPlace` ADD CONSTRAINT `CampaignPlace_campaignId_parentEntityId_fkey` FOREIGN KEY (`campaignId`, `parentEntityId`) REFERENCES `CampaignPlace`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CampaignPlace` ADD CONSTRAINT `CampaignPlace_campaignId_mapId_fkey` FOREIGN KEY (`campaignId`, `mapId`) REFERENCES `CampaignLoreMap`(`campaignId`, `mapId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CampaignFaction` ADD CONSTRAINT `CampaignFaction_campaignId_entityId_fkey` FOREIGN KEY (`campaignId`, `entityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignNpc` ADD CONSTRAINT `CampaignNpc_campaignId_entityId_fkey` FOREIGN KEY (`campaignId`, `entityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignNpc` ADD CONSTRAINT `CampaignNpc_campaignId_placeEntityId_fkey` FOREIGN KEY (`campaignId`, `placeEntityId`) REFERENCES `CampaignPlace`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CampaignNpc` ADD CONSTRAINT `CampaignNpc_campaignId_factionEntityId_fkey` FOREIGN KEY (`campaignId`, `factionEntityId`) REFERENCES `CampaignFaction`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CampaignPlotObject` ADD CONSTRAINT `CampaignPlotObject_campaignId_entityId_fkey` FOREIGN KEY (`campaignId`, `entityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignPlotObject` ADD CONSTRAINT `CampaignPlotObject_campaignId_placeEntityId_fkey` FOREIGN KEY (`campaignId`, `placeEntityId`) REFERENCES `CampaignPlace`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TravelRoute` ADD CONSTRAINT `TravelRoute_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TravelRoute` ADD CONSTRAINT `TravelRoute_campaignId_fromEntityId_fkey` FOREIGN KEY (`campaignId`, `fromEntityId`) REFERENCES `CampaignPlace`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TravelRoute` ADD CONSTRAINT `TravelRoute_campaignId_toEntityId_fkey` FOREIGN KEY (`campaignId`, `toEntityId`) REFERENCES `CampaignPlace`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `SceneState` ADD CONSTRAINT `SceneState_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CampaignLore`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SceneState` ADD CONSTRAINT `SceneState_campaignId_placeEntityId_fkey` FOREIGN KEY (`campaignId`, `placeEntityId`) REFERENCES `CampaignPlace`(`campaignId`, `entityId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CampaignCharacter` ADD CONSTRAINT `CampaignCharacter_campaignId_entityId_fkey` FOREIGN KEY (`campaignId`, `entityId`) REFERENCES `CampaignEntity`(`campaignId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignCharacter` ADD CONSTRAINT `CampaignCharacter_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignCharacter` ADD CONSTRAINT `CampaignCharacter_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `SceneState`(`campaignId`) ON DELETE CASCADE ON UPDATE CASCADE;

