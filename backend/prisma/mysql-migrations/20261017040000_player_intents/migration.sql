ALTER TABLE `GameMasterTurn`
  ADD COLUMN `playerEntityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  ADD COLUMN `parentTurnId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  ADD COLUMN `replyKind` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
  MODIFY `status` ENUM('REQUESTED','GENERATING','READY','FAILED','STALE','CANCELLED','COMMITTED','WAITING_PLAYER') NOT NULL DEFAULT 'REQUESTED';

CREATE UNIQUE INDEX `GameMasterTurn_parentTurnId_key` ON `GameMasterTurn`(`parentTurnId`);
CREATE UNIQUE INDEX `GameMasterTurn_campaignId_id_key` ON `GameMasterTurn`(`campaignId`,`id`);
CREATE UNIQUE INDEX `GameMasterTurn_campaignId_parentTurnId_key` ON `GameMasterTurn`(`campaignId`,`parentTurnId`);
CREATE INDEX `GameMasterTurn_campaignId_requestedById_createdAt_idx` ON `GameMasterTurn`(`campaignId`,`requestedById`,`createdAt`);
ALTER TABLE `GameMasterTurn` ADD CONSTRAINT `GameMasterTurn_campaignId_playerEntityId_fkey`
  FOREIGN KEY (`campaignId`,`playerEntityId`) REFERENCES `CampaignEntity`(`campaignId`,`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `GameMasterTurn` ADD CONSTRAINT `GameMasterTurn_campaignId_parentTurnId_fkey`
  FOREIGN KEY (`campaignId`,`parentTurnId`) REFERENCES `GameMasterTurn`(`campaignId`,`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
