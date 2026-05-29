-- AlterTable
ALTER TABLE "CustomPage" ADD COLUMN "fileAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "CustomPage" ADD CONSTRAINT "CustomPage_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
