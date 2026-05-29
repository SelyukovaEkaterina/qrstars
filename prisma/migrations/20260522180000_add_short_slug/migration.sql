ALTER TABLE "Establishment" ADD COLUMN "shortSlug" TEXT;
CREATE UNIQUE INDEX "Establishment_shortSlug_key" ON "Establishment"("shortSlug");
