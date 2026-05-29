ALTER TABLE "Establishment"
  ADD COLUMN IF NOT EXISTS "landingTipsType" TEXT,
  ADD COLUMN IF NOT EXISTS "landingTipsPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "landingTipsBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "landingTipsUrl" TEXT;
