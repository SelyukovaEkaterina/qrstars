-- Tips employees belong to establishment
ALTER TABLE "TipsEmployee" ADD COLUMN "establishmentId" TEXT;

UPDATE "TipsEmployee" te
SET "establishmentId" = q."establishmentId"
FROM "QRCode" q
WHERE te."qrCodeId" = q.id AND q."establishmentId" IS NOT NULL;

-- Copy QR tips settings to establishment when landing fields are empty
UPDATE "Establishment" e
SET
  "landingTipsType" = COALESCE(e."landingTipsType", sub."tipsType"),
  "landingTipsPhone" = COALESCE(e."landingTipsPhone", sub."tipsPhone"),
  "landingTipsBankName" = COALESCE(e."landingTipsBankName", sub."tipsBankName"),
  "landingTipsUrl" = COALESCE(
    e."landingTipsUrl",
    CASE WHEN sub."tipsType" = 'REDIRECT' THEN sub."redirectUrl" ELSE NULL END
  )
FROM (
  SELECT DISTINCT ON ("establishmentId")
    "establishmentId",
    "tipsType",
    "tipsPhone",
    "tipsBankName",
    "redirectUrl"
  FROM "QRCode"
  WHERE "establishmentId" IS NOT NULL AND "tipsType" IS NOT NULL
  ORDER BY "establishmentId", "updatedAt" DESC
) sub
WHERE e.id = sub."establishmentId";

DELETE FROM "TipsEmployee" WHERE "establishmentId" IS NULL;

ALTER TABLE "TipsEmployee" ALTER COLUMN "establishmentId" SET NOT NULL;

ALTER TABLE "TipsEmployee" ADD CONSTRAINT "TipsEmployee_establishmentId_fkey"
  FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TipsEmployee_establishmentId_idx" ON "TipsEmployee"("establishmentId");

ALTER TABLE "TipsEmployee" DROP CONSTRAINT IF EXISTS "TipsEmployee_qrCodeId_fkey";
ALTER TABLE "TipsEmployee" ALTER COLUMN "qrCodeId" DROP NOT NULL;
ALTER TABLE "TipsEmployee" ADD CONSTRAINT "TipsEmployee_qrCodeId_fkey"
  FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
