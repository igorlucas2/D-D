CREATE TABLE `RagnarokCharacterItem` (
  `id` VARCHAR(191) NOT NULL,
  `characterId` VARCHAR(191) NOT NULL,
  `itemId` INTEGER NOT NULL,
  `slot` VARCHAR(191) NULL,
  `equipped` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `RagnarokCharacterItem_characterId_itemId_key`(`characterId`, `itemId`),
  INDEX `RagnarokCharacterItem_itemId_idx`(`itemId`),
  CONSTRAINT `RagnarokCharacterItem_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `RagnarokCharacter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RagnarokCharacterItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `RagnarokItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;