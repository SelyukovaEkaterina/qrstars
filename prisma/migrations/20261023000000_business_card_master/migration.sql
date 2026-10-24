-- QR-визитка мастера: мессенджеры, услуги, район, часы, отзывы
ALTER TABLE "BusinessCard" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "BusinessCard" ADD COLUMN "telegram" TEXT;
ALTER TABLE "BusinessCard" ADD COLUMN "maxUrl" TEXT;
ALTER TABLE "BusinessCard" ADD COLUMN "services" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "BusinessCard" ADD COLUMN "serviceArea" TEXT;
ALTER TABLE "BusinessCard" ADD COLUMN "workHours" TEXT;
ALTER TABLE "BusinessCard" ADD COLUMN "reviewsUrl" TEXT;
