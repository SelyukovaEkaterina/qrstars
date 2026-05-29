-- AlterTable
ALTER TABLE "BusinessCard" ADD COLUMN     "estId" TEXT,
ADD COLUMN     "tipsLabel" TEXT,
ADD COLUMN     "tipsUrl" TEXT;

-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "moduleTypes" JSONB;

-- AlterTable
ALTER TABLE "QRMenu" ADD COLUMN     "estId" TEXT;

-- AlterTable
ALTER TABLE "WifiConfig" ADD COLUMN     "estId" TEXT;
