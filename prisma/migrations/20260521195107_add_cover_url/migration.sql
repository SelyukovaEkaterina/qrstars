/*
  Warnings:

  - The `status` column on the `PartnerEarning` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `PartnerWithdrawal` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `userId` on table `BusinessCard` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `WifiConfig` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PartnerEarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PartnerWithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- DropIndex
DROP INDEX "CustomPage_establishmentId_idx";

-- AlterTable
ALTER TABLE "BusinessCard" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "moduleLabels" JSONB;

-- AlterTable
ALTER TABLE "PartnerEarning" DROP COLUMN "status",
ADD COLUMN     "status" "PartnerEarningStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "PartnerWithdrawal" DROP COLUMN "status",
ADD COLUMN     "status" "PartnerWithdrawalStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "WifiConfig" ALTER COLUMN "userId" SET NOT NULL;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
