-- AlterTable
ALTER TABLE "CaptureJob" ADD COLUMN "analysisSummary" TEXT;
ALTER TABLE "CaptureJob" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "CaptureJob" ADD COLUMN "executionLog" TEXT;
ALTER TABLE "CaptureJob" ADD COLUMN "exitCode" INTEGER;
ALTER TABLE "CaptureJob" ADD COLUMN "startedAt" DATETIME;
