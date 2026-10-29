CREATE TABLE `CampaignRagnarokCharacter` (
  `campaignId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
  `characterId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`campaignId`, `characterId`),
  UNIQUE INDEX `CampaignRagnarokCharacter_characterId_key`(`characterId`),
  INDEX `CampaignRagnarokCharacter_campaignId_idx`(`campaignId`),
  CONSTRAINT `CampaignRagnarokCharacter_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CampaignRagnarokCharacter_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `RagnarokCharacter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;