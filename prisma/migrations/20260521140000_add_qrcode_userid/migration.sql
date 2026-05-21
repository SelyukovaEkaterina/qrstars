-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN "userId" TEXT;

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: set userId from linked establishment's owner
UPDATE "QRCode" q
SET "userId" = e."userId"
FROM "Establishment" e
WHERE q."establishmentId" = e.id AND q."userId" IS NULL;
