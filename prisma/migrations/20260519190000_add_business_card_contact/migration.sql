-- AlterTable
ALTER TABLE "BusinessCard" ADD COLUMN "contactEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessCard" ADD COLUMN "contactTelegramChatId" TEXT;
ALTER TABLE "BusinessCard" ADD COLUMN "contactTelegramEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessCard" ADD COLUMN "contactMaxUserId" TEXT;
ALTER TABLE "BusinessCard" ADD COLUMN "contactMaxEnabled" BOOLEAN NOT NULL DEFAULT false;
