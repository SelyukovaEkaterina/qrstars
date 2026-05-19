-- CreateEnum
CREATE TYPE "QRCodeMode" AS ENUM ('REVIEW', 'REDIRECT');

-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN     "mode" "QRCodeMode" NOT NULL DEFAULT 'REVIEW';
