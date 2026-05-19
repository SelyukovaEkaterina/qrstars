-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QRCodeMode" ADD VALUE 'BUSINESS_CARD';
ALTER TYPE "QRCodeMode" ADD VALUE 'WIFI';

-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN     "businessCardId" TEXT,
ADD COLUMN     "wifiConfigId" TEXT;

-- CreateTable
CREATE TABLE "BusinessCard" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "about" TEXT,
    "avatarUrl" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "theme" TEXT NOT NULL DEFAULT 'minimal',
    "accentColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WifiConfig" (
    "id" TEXT NOT NULL,
    "ssid" TEXT NOT NULL,
    "password" TEXT,
    "encryption" TEXT NOT NULL DEFAULT 'WPA',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WifiConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_businessCardId_fkey" FOREIGN KEY ("businessCardId") REFERENCES "BusinessCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_wifiConfigId_fkey" FOREIGN KEY ("wifiConfigId") REFERENCES "WifiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
