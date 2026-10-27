-- MySQL 8.0+; binary identity keys preserve SQLite case/accent distinctions.
-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `email` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `avatarUrl` TEXT NULL,
    `bio` LONGTEXT NULL,
    `accountLevel` INTEGER NOT NULL DEFAULT 1,
    `accountXp` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Achievement` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `code` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `icon` VARCHAR(191) NULL,

    UNIQUE INDEX `Achievement_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAchievement` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `achievementId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `unlockedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserAchievement_userId_achievementId_key`(`userId`, `achievementId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Character` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `race` VARCHAR(191) NOT NULL,
    `class` VARCHAR(191) NOT NULL,
    `subclass` VARCHAR(191) NULL,
    `background` LONGTEXT NULL,
    `alignment` VARCHAR(191) NULL,
    `deity` VARCHAR(191) NULL,
    `appearance` LONGTEXT NULL,
    `backstory` LONGTEXT NULL,
    `portraitUrl` TEXT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `strength` INTEGER NOT NULL DEFAULT 10,
    `dexterity` INTEGER NOT NULL DEFAULT 10,
    `constitution` INTEGER NOT NULL DEFAULT 10,
    `intelligence` INTEGER NOT NULL DEFAULT 10,
    `wisdom` INTEGER NOT NULL DEFAULT 10,
    `charisma` INTEGER NOT NULL DEFAULT 10,
    `maxHp` INTEGER NOT NULL DEFAULT 0,
    `currentHp` INTEGER NOT NULL DEFAULT 0,
    `tempHp` INTEGER NOT NULL DEFAULT 0,
    `armorClass` INTEGER NOT NULL DEFAULT 10,
    `initiative` INTEGER NOT NULL DEFAULT 0,
    `proficiencyBonus` INTEGER NOT NULL DEFAULT 2,
    `speed` INTEGER NOT NULL DEFAULT 9,
    `maxMana` INTEGER NOT NULL DEFAULT 0,
    `currentMana` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterResistance` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `damageType` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `type` ENUM('RESISTANCE', 'IMMUNITY', 'VULNERABILITY') NOT NULL,

    UNIQUE INDEX `CharacterResistance_characterId_damageType_type_key`(`characterId`, `damageType`, `type`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Item` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `srdIndex` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `sourceUrl` TEXT NULL,
    `source` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `srdUpdatedAt` DATETIME(3) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `weight` DOUBLE NOT NULL DEFAULT 0,
    `value` INTEGER NOT NULL DEFAULT 0,
    `rarity` ENUM('COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY', 'ARTIFACT') NOT NULL DEFAULT 'COMMON',
    `category` VARCHAR(191) NOT NULL,
    `slot` ENUM('HEAD', 'CHEST', 'LEGS', 'FEET', 'HANDS', 'MAIN_HAND', 'OFF_HAND', 'RING', 'AMULET', 'CLOAK', 'NONE') NOT NULL DEFAULT 'NONE',
    `properties` LONGTEXT NULL,
    `imageUrl` TEXT NULL,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryItem` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `itemId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `equipped` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Spell` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `srdIndex` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `sourceUrl` TEXT NULL,
    `source` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `srdUpdatedAt` DATETIME(3) NULL,
    `name` VARCHAR(191) NOT NULL,
    `school` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `range` VARCHAR(191) NOT NULL,
    `duration` VARCHAR(191) NOT NULL,
    `concentration` BOOLEAN NOT NULL DEFAULT false,
    `description` LONGTEXT NULL,
    `classes` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterSpell` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `spellId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `prepared` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `CharacterSpell_characterId_spellId_key`(`characterId`, `spellId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterSpellSlot` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `level` INTEGER NOT NULL,
    `total` INTEGER NOT NULL DEFAULT 0,
    `used` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `CharacterSpellSlot_characterId_level_key`(`characterId`, `level`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiceRoll` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `visibility` ENUM('PUBLIC', 'MASTER', 'PRIVATE') NOT NULL DEFAULT 'PRIVATE',
    `formula` VARCHAR(191) NOT NULL,
    `result` INTEGER NOT NULL,
    `breakdown` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiceRoll_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `masterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `inviteCode` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `combatHpDisplay` ENUM('DESCRIPTIVE', 'NUMERIC') NOT NULL DEFAULT 'DESCRIPTIVE',
    `assistantEnabled` BOOLEAN NOT NULL DEFAULT false,
    `assistantMonthlyLimit` INTEGER NOT NULL DEFAULT 30,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Campaign_inviteCode_key`(`inviteCode`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignMember` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `role` ENUM('MASTER', 'PLAYER') NOT NULL DEFAULT 'PLAYER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NULL,
    `lastSeenGameMinutes` INTEGER NULL,

    UNIQUE INDEX `CampaignMember_campaignId_userId_key`(`campaignId`, `userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CombatEncounter` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Combate',
    `round` INTEGER NOT NULL DEFAULT 1,
    `turnIndex` INTEGER NOT NULL DEFAULT 0,
    `hpDisplay` ENUM('DESCRIPTIVE', 'NUMERIC') NOT NULL DEFAULT 'DESCRIPTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CombatEncounter_campaignId_key`(`campaignId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CombatParticipant` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `encounterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `name` VARCHAR(191) NOT NULL,
    `initiative` INTEGER NOT NULL DEFAULT 0,
    `maxHp` INTEGER NOT NULL DEFAULT 1,
    `currentHp` INTEGER NOT NULL DEFAULT 1,
    `conditions` LONGTEXT NULL,
    `isAlly` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VttMap` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `parentMapId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `kind` ENUM('WORLD', 'REGION', 'SETTLEMENT', 'BUILDING', 'INTERIOR', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `name` VARCHAR(191) NOT NULL,
    `width` INTEGER NOT NULL DEFAULT 24,
    `height` INTEGER NOT NULL DEFAULT 16,
    `gridSize` INTEGER NOT NULL DEFAULT 1,
    `gridColor` VARCHAR(191) NOT NULL DEFAULT '#94a3b8',
    `imageUrl` TEXT NULL,
    `fogOfWarData` LONGTEXT NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `lightingMode` ENUM('AUTO', 'INDOOR', 'FIXED_DAY', 'FIXED_NIGHT') NOT NULL DEFAULT 'AUTO',
    `vision` ENUM('OFF', 'LIT', 'DARK') NOT NULL DEFAULT 'OFF',
    `wallsData` LONGTEXT NULL,
    `ambiencePreset` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VttMap_parentMapId_idx`(`parentMapId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VttMapHotspot` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `mapId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `x` INTEGER NOT NULL DEFAULT 0,
    `y` INTEGER NOT NULL DEFAULT 0,
    `width` INTEGER NOT NULL DEFAULT 1,
    `height` INTEGER NOT NULL DEFAULT 1,
    `label` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL DEFAULT 'map-pin',
    `color` VARCHAR(191) NOT NULL DEFAULT '#38bdf8',
    `targetMapId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `visibleToPlayers` BOOLEAN NOT NULL DEFAULT true,
    `travelActionCost` INTEGER NOT NULL DEFAULT 1,
    `travelMinutes` INTEGER NOT NULL DEFAULT 30,
    `eventNote` LONGTEXT NULL,
    `triggerJournalCategory` ENUM('SESSAO', 'EVENTO', 'MORTE', 'LOOT', 'DECISAO', 'OUTRO') NULL,
    `firstVisitedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VttMapHotspot_targetMapId_key`(`targetMapId`),
    INDEX `VttMapHotspot_mapId_idx`(`mapId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VttToken` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `mapId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `name` VARCHAR(191) NOT NULL,
    `x` INTEGER NOT NULL DEFAULT 0,
    `y` INTEGER NOT NULL DEFAULT 0,
    `size` INTEGER NOT NULL DEFAULT 1,
    `color` VARCHAR(191) NOT NULL DEFAULT '#f59e0b',
    `imageUrl` TEXT NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `lightRadius` INTEGER NOT NULL DEFAULT 0,
    `visionRadius` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VttMarker` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `mapId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `x` INTEGER NOT NULL DEFAULT 0,
    `y` INTEGER NOT NULL DEFAULT 0,
    `label` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#38bdf8',
    `note` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignJournalEntry` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `authorId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `category` ENUM('SESSAO', 'EVENTO', 'MORTE', 'LOOT', 'DECISAO', 'OUTRO') NOT NULL DEFAULT 'SESSAO',
    `sessionDate` DATETIME(3) NULL,
    `restricted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntryRecipient` (
    `entryId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,

    INDEX `JournalEntryRecipient_userId_idx`(`userId`),
    PRIMARY KEY (`entryId`, `userId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NarrationDraft` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `mapId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NarrationDraft_campaignId_idx`(`campaignId`),
    INDEX `NarrationDraft_mapId_idx`(`mapId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Monster` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `srdIndex` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `sourceUrl` TEXT NULL,
    `source` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `srdUpdatedAt` DATETIME(3) NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `size` VARCHAR(191) NOT NULL,
    `armorClass` INTEGER NOT NULL,
    `maxHp` INTEGER NOT NULL,
    `speed` INTEGER NOT NULL DEFAULT 9,
    `strength` INTEGER NOT NULL DEFAULT 10,
    `dexterity` INTEGER NOT NULL DEFAULT 10,
    `constitution` INTEGER NOT NULL DEFAULT 10,
    `intelligence` INTEGER NOT NULL DEFAULT 10,
    `wisdom` INTEGER NOT NULL DEFAULT 10,
    `charisma` INTEGER NOT NULL DEFAULT 10,
    `challengeRating` VARCHAR(191) NOT NULL,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `traits` LONGTEXT NULL,
    `actions` LONGTEXT NULL,
    `description` LONGTEXT NULL,
    `imageUrl` TEXT NULL,
    `isNpc` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RuleSection` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `srdIndex` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `sourceUrl` TEXT NULL,
    `source` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `srdUpdatedAt` DATETIME(3) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,

    UNIQUE INDEX `RuleSection_srdIndex_key`(`srdIndex`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SrdResource` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `endpoint` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `index` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `source` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'dnd5eapi-2014',
    `data` LONGTEXT NOT NULL,
    `srdUpdatedAt` DATETIME(3) NULL,
    `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SrdResource_endpoint_idx`(`endpoint`),
    INDEX `SrdResource_name_idx`(`name`),
    UNIQUE INDEX `SrdResource_endpoint_index_key`(`endpoint`, `index`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaptureTarget` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `providerType` ENUM('LINUX_SSH', 'WINDOWS_LOCAL', 'MANUAL_UPLOAD') NOT NULL,
    `osLabel` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NULL,
    `sshPort` INTEGER NULL,
    `sshUser` VARCHAR(191) NULL,
    `defaultInterface` VARCHAR(191) NULL,
    `defaultOutputDir` TEXT NOT NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CaptureTarget_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaptureJob` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `targetId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `providerType` ENUM('LINUX_SSH', 'WINDOWS_LOCAL', 'MANUAL_UPLOAD') NOT NULL,
    `profile` ENUM('SIP_BASIC', 'SIPS_BASIC', 'SIP_SIPS', 'IP_FULL', 'SIP_RTP') NOT NULL,
    `status` ENUM('READY', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'READY',
    `label` VARCHAR(191) NOT NULL,
    `monitoredIp` VARCHAR(191) NOT NULL,
    `interfaceName` VARCHAR(191) NULL,
    `durationSeconds` INTEGER NOT NULL,
    `maxFileMb` INTEGER NOT NULL,
    `outputDirectory` TEXT NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `bpfFilter` TEXT NULL,
    `commandDialect` VARCHAR(191) NOT NULL,
    `commandPreview` LONGTEXT NULL,
    `localPath` TEXT NULL,
    `notes` LONGTEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `exitCode` INTEGER NULL,
    `executionLog` LONGTEXT NULL,
    `analysisSummary` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CaptureJob_userId_idx`(`userId`),
    INDEX `CaptureJob_targetId_idx`(`targetId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignWorldEntry` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `parentId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `type` ENUM('CONTINENTE', 'REINO', 'FACCAO', 'RELIGIAO', 'IDIOMA', 'OUTRO') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `summary` LONGTEXT NULL,
    `description` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampaignWorldEntry_campaignId_idx`(`campaignId`),
    INDEX `CampaignWorldEntry_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignCalendar` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `monthNames` LONGTEXT NOT NULL,
    `daysPerMonth` LONGTEXT NOT NULL,
    `weekdayNames` LONGTEXT NOT NULL,
    `totalMinutes` INTEGER NOT NULL DEFAULT 0,
    `currentDay` INTEGER NOT NULL DEFAULT 1,
    `currentMonth` INTEGER NOT NULL DEFAULT 1,
    `currentYear` INTEGER NOT NULL DEFAULT 1,
    `currentHour` INTEGER NOT NULL DEFAULT 8,
    `currentMinute` INTEGER NOT NULL DEFAULT 0,
    `notes` LONGTEXT NULL,
    `realMinutesPerTick` INTEGER NOT NULL DEFAULT 0,
    `gameMinutesPerTick` INTEGER NOT NULL DEFAULT 60,
    `eventChancePercent` INTEGER NOT NULL DEFAULT 0,
    `weather` VARCHAR(191) NOT NULL DEFAULT 'clear',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CampaignCalendar_campaignId_key`(`campaignId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignWorldEvent` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `category` ENUM('SESSAO', 'EVENTO', 'MORTE', 'LOOT', 'DECISAO', 'OUTRO') NOT NULL DEFAULT 'EVENTO',
    `weight` INTEGER NOT NULL DEFAULT 1,
    `weatherEffect` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampaignWorldEvent_campaignId_idx`(`campaignId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterExplorationState` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `currentMapId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `actionPoints` INTEGER NOT NULL DEFAULT 6,
    `maxActionPoints` INTEGER NOT NULL DEFAULT 6,
    `fatigue` INTEGER NOT NULL DEFAULT 0,
    `lastRestAtMinutes` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CharacterExplorationState_characterId_key`(`characterId`),
    INDEX `CharacterExplorationState_campaignId_idx`(`campaignId`),
    INDEX `CharacterExplorationState_currentMapId_idx`(`currentMapId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterLanguage` (
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `languageId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CharacterLanguage_languageId_idx`(`languageId`),
    PRIMARY KEY (`characterId`, `languageId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `authorId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `characterId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `kind` ENUM('IC', 'OOC', 'EMOTE', 'WHISPER') NOT NULL DEFAULT 'IC',
    `content` LONGTEXT NOT NULL,
    `languageId` VARCHAR(191) COLLATE utf8mb4_0900_bin NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessageRecipient` (
    `messageId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,

    INDEX `ChatMessageRecipient_userId_idx`(`userId`),
    PRIMARY KEY (`messageId`, `userId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssistantRequest` (
    `id` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `campaignId` VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `inputTokens` INTEGER NOT NULL DEFAULT 0,
    `outputTokens` INTEGER NOT NULL DEFAULT 0,
    `refused` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssistantRequest_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserAchievement` ADD CONSTRAINT `UserAchievement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAchievement` ADD CONSTRAINT `UserAchievement_achievementId_fkey` FOREIGN KEY (`achievementId`) REFERENCES `Achievement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Character` ADD CONSTRAINT `Character_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterResistance` ADD CONSTRAINT `CharacterResistance_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryItem` ADD CONSTRAINT `InventoryItem_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryItem` ADD CONSTRAINT `InventoryItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterSpell` ADD CONSTRAINT `CharacterSpell_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterSpell` ADD CONSTRAINT `CharacterSpell_spellId_fkey` FOREIGN KEY (`spellId`) REFERENCES `Spell`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterSpellSlot` ADD CONSTRAINT `CharacterSpellSlot_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiceRoll` ADD CONSTRAINT `DiceRoll_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiceRoll` ADD CONSTRAINT `DiceRoll_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiceRoll` ADD CONSTRAINT `DiceRoll_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignMember` ADD CONSTRAINT `CampaignMember_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignMember` ADD CONSTRAINT `CampaignMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombatEncounter` ADD CONSTRAINT `CombatEncounter_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombatParticipant` ADD CONSTRAINT `CombatParticipant_encounterId_fkey` FOREIGN KEY (`encounterId`) REFERENCES `CombatEncounter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombatParticipant` ADD CONSTRAINT `CombatParticipant_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VttMap` ADD CONSTRAINT `VttMap_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VttMap` ADD CONSTRAINT `VttMap_parentMapId_fkey` FOREIGN KEY (`parentMapId`) REFERENCES `VttMap`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VttMapHotspot` ADD CONSTRAINT `VttMapHotspot_mapId_fkey` FOREIGN KEY (`mapId`) REFERENCES `VttMap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VttMapHotspot` ADD CONSTRAINT `VttMapHotspot_targetMapId_fkey` FOREIGN KEY (`targetMapId`) REFERENCES `VttMap`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VttToken` ADD CONSTRAINT `VttToken_mapId_fkey` FOREIGN KEY (`mapId`) REFERENCES `VttMap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VttToken` ADD CONSTRAINT `VttToken_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VttMarker` ADD CONSTRAINT `VttMarker_mapId_fkey` FOREIGN KEY (`mapId`) REFERENCES `VttMap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignJournalEntry` ADD CONSTRAINT `CampaignJournalEntry_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignJournalEntry` ADD CONSTRAINT `CampaignJournalEntry_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntryRecipient` ADD CONSTRAINT `JournalEntryRecipient_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `CampaignJournalEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntryRecipient` ADD CONSTRAINT `JournalEntryRecipient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NarrationDraft` ADD CONSTRAINT `NarrationDraft_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NarrationDraft` ADD CONSTRAINT `NarrationDraft_mapId_fkey` FOREIGN KEY (`mapId`) REFERENCES `VttMap`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaptureTarget` ADD CONSTRAINT `CaptureTarget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaptureJob` ADD CONSTRAINT `CaptureJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaptureJob` ADD CONSTRAINT `CaptureJob_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `CaptureTarget`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignWorldEntry` ADD CONSTRAINT `CampaignWorldEntry_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignWorldEntry` ADD CONSTRAINT `CampaignWorldEntry_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `CampaignWorldEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignCalendar` ADD CONSTRAINT `CampaignCalendar_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignWorldEvent` ADD CONSTRAINT `CampaignWorldEvent_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterExplorationState` ADD CONSTRAINT `CharacterExplorationState_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterExplorationState` ADD CONSTRAINT `CharacterExplorationState_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterExplorationState` ADD CONSTRAINT `CharacterExplorationState_currentMapId_fkey` FOREIGN KEY (`currentMapId`) REFERENCES `VttMap`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterLanguage` ADD CONSTRAINT `CharacterLanguage_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterLanguage` ADD CONSTRAINT `CharacterLanguage_languageId_fkey` FOREIGN KEY (`languageId`) REFERENCES `CampaignWorldEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_languageId_fkey` FOREIGN KEY (`languageId`) REFERENCES `CampaignWorldEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessageRecipient` ADD CONSTRAINT `ChatMessageRecipient_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessageRecipient` ADD CONSTRAINT `ChatMessageRecipient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssistantRequest` ADD CONSTRAINT `AssistantRequest_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

