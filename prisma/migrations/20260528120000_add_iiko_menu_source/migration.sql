-- CreateEnum
CREATE TYPE "MenuSource" AS ENUM ('MANUAL', 'IIKO');

-- AlterTable
ALTER TABLE "QRMenu" ADD COLUMN "source" "MenuSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "QRMenu" ADD COLUMN "iikoApiLogin" TEXT;
ALTER TABLE "QRMenu" ADD COLUMN "iikoOrganizationId" TEXT;
ALTER TABLE "QRMenu" ADD COLUMN "iikoExternalMenuId" TEXT;
ALTER TABLE "QRMenu" ADD COLUMN "iikoPriceCategoryId" TEXT;
ALTER TABLE "QRMenu" ADD COLUMN "iikoTerminalGroupId" TEXT;
ALTER TABLE "QRMenu" ADD COLUMN "iikoPaymentTypeId" TEXT;
ALTER TABLE "QRMenu" ADD COLUMN "iikoOrderTypePickupId" TEXT;
ALTER TABLE "QRMenu" ADD COLUMN "iikoOrderTypeDeliveryId" TEXT;

-- AlterTable
ALTER TABLE "MenuOrder" ADD COLUMN "iikoOrderId" TEXT;
ALTER TABLE "MenuOrder" ADD COLUMN "iikoCorrelationId" TEXT;
