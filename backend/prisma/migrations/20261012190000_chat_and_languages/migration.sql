-- Conversa da mesa e idiomas dos personagens (IM-11).
-- CreateTable
CREATE TABLE "CharacterLanguage" (
    "characterId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("characterId", "languageId"),
    CONSTRAINT "CharacterLanguage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "CampaignWorldEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "characterId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'IC',
    "content" TEXT NOT NULL,
    "languageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "CampaignWorldEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessageRecipient" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("messageId", "userId"),
    CONSTRAINT "ChatMessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessageRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CharacterLanguage_languageId_idx" ON "CharacterLanguage"("languageId");

-- CreateIndex
CREATE INDEX "ChatMessage_campaignId_createdAt_idx" ON "ChatMessage"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessageRecipient_userId_idx" ON "ChatMessageRecipient"("userId");

