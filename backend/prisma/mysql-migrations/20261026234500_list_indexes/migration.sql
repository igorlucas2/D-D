-- CreateIndex
CREATE INDEX `Item_name_idx` ON `Item`(`name`);

-- CreateIndex
CREATE INDEX `Spell_name_idx` ON `Spell`(`name`);

-- CreateIndex
CREATE INDEX `Monster_name_idx` ON `Monster`(`name`);

-- CreateIndex
CREATE INDEX `RuleSection_name_idx` ON `RuleSection`(`name`);

-- CreateIndex
CREATE INDEX `SrdResource_endpoint_name_idx` ON `SrdResource`(`endpoint`, `name`);

-- CreateIndex
CREATE INDEX `CampaignJournalEntry_campaignId_sessionDate_createdAt_idx` ON `CampaignJournalEntry`(`campaignId`, `sessionDate`, `createdAt`);

-- CreateIndex
CREATE INDEX `DiceRoll_userId_createdAt_idx` ON `DiceRoll`(`userId`, `createdAt`);
