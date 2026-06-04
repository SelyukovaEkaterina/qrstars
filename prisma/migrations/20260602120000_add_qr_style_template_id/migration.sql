-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN "qrStyleTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_qrStyleTemplateId_fkey" FOREIGN KEY ("qrStyleTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
