-- CreateEnum
CREATE TYPE "QRCodeSource" AS ENUM ('DASHBOARD', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'ACTIVATED');

-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "serialCode" TEXT,
ADD COLUMN     "source" "QRCodeSource" NOT NULL DEFAULT 'DASHBOARD';

-- CreateTable
CREATE TABLE "ActivationBatch" (
    "id" TEXT NOT NULL,
    "masterCode" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "label" TEXT,
    "qty" INTEGER NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "establishmentId" TEXT,

    CONSTRAINT "ActivationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivationBatch_masterCode_key" ON "ActivationBatch"("masterCode");

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ActivationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationBatch" ADD CONSTRAINT "ActivationBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationBatch" ADD CONSTRAINT "ActivationBatch_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backward compat: mark existing inactive QR codes (legacy marketplace tablets) as MARKETPLACE
UPDATE "QRCode" SET source = 'MARKETPLACE' WHERE "isActive" = false AND "establishmentId" IS NULL;
