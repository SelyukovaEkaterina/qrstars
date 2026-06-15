-- AlterTable: multiple feedback surveys per user (d7, d90, d365)
ALTER TABLE "UserFeedback" ADD COLUMN "surveyKind" TEXT NOT NULL DEFAULT 'd7';

-- DropIndex
DROP INDEX "UserFeedback_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "UserFeedback_userId_surveyKind_key" ON "UserFeedback"("userId", "surveyKind");

-- CreateIndex
CREATE INDEX "UserFeedback_surveyKind_createdAt_idx" ON "UserFeedback"("surveyKind", "createdAt");
