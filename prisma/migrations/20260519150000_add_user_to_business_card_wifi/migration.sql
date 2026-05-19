-- AlterTable
ALTER TABLE "BusinessCard" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "WifiConfig" ADD COLUMN "userId" TEXT;

-- AddForeignKey
ALTER TABLE "BusinessCard" ADD CONSTRAINT "BusinessCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WifiConfig" ADD CONSTRAINT "WifiConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
