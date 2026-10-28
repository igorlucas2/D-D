ALTER TABLE `RagnarokCharacter`
  ADD COLUMN `maxHp` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `currentHp` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `maxSp` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `currentSp` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `RagnarokCharacterSkill` (
  `id` VARCHAR(191) NOT NULL,
  `characterId` VARCHAR(191) NOT NULL,
  `skillId` INTEGER NOT NULL,
  `level` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `RagnarokCharacterSkill_characterId_skillId_key`(`characterId`, `skillId`),
  INDEX `RagnarokCharacterSkill_skillId_idx`(`skillId`),
  CONSTRAINT `RagnarokCharacterSkill_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `RagnarokCharacter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RagnarokCharacterSkill_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `RagnarokSkill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;