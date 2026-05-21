-- AlterEnum
ALTER TYPE "QRCodeMode" ADD VALUE 'LANDING';

-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN "menuId" TEXT,
ADD COLUMN "businessCardId" TEXT,
ADD COLUMN "wifiConfigId" TEXT,
ADD COLUMN "pageModules" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_menuId_key" ON "Establishment"("menuId");
CREATE UNIQUE INDEX "Establishment_businessCardId_key" ON "Establishment"("businessCardId");
CREATE UNIQUE INDEX "Establishment_wifiConfigId_key" ON "Establishment"("wifiConfigId");

-- AddForeignKey
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "QRMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_businessCardId_fkey" FOREIGN KEY ("businessCardId") REFERENCES "BusinessCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_wifiConfigId_fkey" FOREIGN KEY ("wifiConfigId") REFERENCES "WifiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate content from first QR per establishment (keep QR FKs for backward compatibility)
UPDATE "Establishment" e
SET "menuId" = sub."menuId"
FROM (
  SELECT DISTINCT ON ("establishmentId") "establishmentId", "menuId"
  FROM "QRCode"
  WHERE "menuId" IS NOT NULL AND "establishmentId" IS NOT NULL
  ORDER BY "establishmentId", "updatedAt" DESC
) sub
WHERE e."id" = sub."establishmentId" AND e."menuId" IS NULL;

UPDATE "Establishment" e
SET "businessCardId" = sub."businessCardId"
FROM (
  SELECT DISTINCT ON ("establishmentId") "establishmentId", "businessCardId"
  FROM "QRCode"
  WHERE "businessCardId" IS NOT NULL AND "establishmentId" IS NOT NULL
  ORDER BY "establishmentId", "updatedAt" DESC
) sub
WHERE e."id" = sub."establishmentId" AND e."businessCardId" IS NULL;

UPDATE "Establishment" e
SET "wifiConfigId" = sub."wifiConfigId"
FROM (
  SELECT DISTINCT ON ("establishmentId") "establishmentId", "wifiConfigId"
  FROM "QRCode"
  WHERE "wifiConfigId" IS NOT NULL AND "establishmentId" IS NOT NULL
  ORDER BY "establishmentId", "updatedAt" DESC
) sub
WHERE e."id" = sub."establishmentId" AND e."wifiConfigId" IS NULL;

-- Default: all modules visible on micro-landing
UPDATE "Establishment"
SET "pageModules" = '{"menu":true,"review":true,"businessCard":true,"wifi":true}'::jsonb
WHERE "pageModules" IS NULL;
