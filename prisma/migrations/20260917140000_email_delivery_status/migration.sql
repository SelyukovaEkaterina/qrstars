-- AlterTable
ALTER TABLE "MessengerContact" ADD COLUMN "lastEmailStatus" TEXT;
ALTER TABLE "MessengerContact" ADD COLUMN "lastEmailAt" TIMESTAMP(3);
ALTER TABLE "MessengerContact" ADD COLUMN "lastEmailError" TEXT;
ALTER TABLE "MessengerContact" ADD COLUMN "lastEmailKind" TEXT;
ALTER TABLE "MessengerContact" ADD COLUMN "lastEmailMessageId" TEXT;
