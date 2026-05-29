-- AlterEnum
ALTER TYPE "QRCodeMode" ADD VALUE 'TIPS';

-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN "tipsType" TEXT,
ADD COLUMN "tipsPhone" TEXT,
ADD COLUMN "tipsBankName" TEXT;
