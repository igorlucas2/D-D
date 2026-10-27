-- CreateTable
CREATE TABLE "CaptureTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "osLabel" TEXT NOT NULL,
    "host" TEXT,
    "sshPort" INTEGER,
    "sshUser" TEXT,
    "defaultInterface" TEXT,
    "defaultOutputDir" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaptureTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaptureJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetId" TEXT,
    "providerType" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "label" TEXT NOT NULL,
    "monitoredIp" TEXT NOT NULL,
    "interfaceName" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "maxFileMb" INTEGER NOT NULL,
    "outputDirectory" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "bpfFilter" TEXT,
    "commandDialect" TEXT NOT NULL,
    "commandPreview" TEXT,
    "localPath" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaptureJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaptureJob_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CaptureTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CaptureTarget_userId_idx" ON "CaptureTarget"("userId");

-- CreateIndex
CREATE INDEX "CaptureJob_userId_idx" ON "CaptureJob"("userId");

-- CreateIndex
CREATE INDEX "CaptureJob_targetId_idx" ON "CaptureJob"("targetId");
