-- AddColumn pdConsentAt/pdConsentIp to Review
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "pdConsentAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "pdConsentIp" TEXT;

-- AddColumn pdConsentAt/pdConsentIp to MenuOrder
ALTER TABLE "MenuOrder" ADD COLUMN IF NOT EXISTS "pdConsentAt" TIMESTAMP(3);
ALTER TABLE "MenuOrder" ADD COLUMN IF NOT EXISTS "pdConsentIp" TEXT;

-- AddColumn pdConsentAt/pdConsentIp to FormSubmission
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "pdConsentAt" TIMESTAMP(3);
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "pdConsentIp" TEXT;
