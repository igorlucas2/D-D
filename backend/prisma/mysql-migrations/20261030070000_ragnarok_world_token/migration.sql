ALTER TABLE `VttToken`
  ADD COLUMN `ragnarokCharacterId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  ADD UNIQUE INDEX `VttToken_ragnarokCharacterId_key`(`ragnarokCharacterId`),
  ADD CONSTRAINT `VttToken_ragnarokCharacterId_fkey` FOREIGN KEY (`ragnarokCharacterId`) REFERENCES `RagnarokCharacter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;