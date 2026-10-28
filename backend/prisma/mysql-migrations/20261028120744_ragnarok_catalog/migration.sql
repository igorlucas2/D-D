-- CreateTable
CREATE TABLE `RagnarokJob` (
    `id` INTEGER NOT NULL,
    `jt` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `hasIcon` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RagnarokJob_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RagnarokSkill` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `maxLevel` INTEGER NOT NULL DEFAULT 1,
    `description` LONGTEXT NULL,
    `delay` INTEGER NULL,
    `parent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RagnarokSkill_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RagnarokItem` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slots` INTEGER NOT NULL DEFAULT 0,
    `aegisName` VARCHAR(191) NULL,
    `resourceName` VARCHAR(191) NULL,
    `description` LONGTEXT NULL,
    `view` INTEGER NULL,
    `spriteView` INTEGER NULL,
    `spriteBlank` BOOLEAN NOT NULL DEFAULT false,
    `viewKind` INTEGER NULL,
    `equipSlots` JSON NULL,
    `costume` BOOLEAN NOT NULL DEFAULT false,
    `contains` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RagnarokItem_name_idx`(`name`),
    INDEX `RagnarokItem_costume_idx`(`costume`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RagnarokMap` (
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
