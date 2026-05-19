-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "notificationEmail" TEXT,
ADD COLUMN     "notificationEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationMaxEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationMaxUserId" TEXT,
ADD COLUMN     "notificationTelegramChatId" TEXT,
ADD COLUMN     "notificationTelegramEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN     "centerLogoUrl" TEXT,
ADD COLUMN     "centerText" TEXT;
