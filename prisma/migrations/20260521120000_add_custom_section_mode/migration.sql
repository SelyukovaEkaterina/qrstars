-- AlterEnum
ALTER TYPE "QRCodeMode" ADD VALUE 'CUSTOM_SECTION';

-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN "customSectionId" TEXT;

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_customSectionId_fkey" FOREIGN KEY ("customSectionId") REFERENCES "CustomPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
