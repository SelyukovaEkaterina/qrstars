-- Микросайт (LANDING) становится платным. Существующие LANDING-QR получают
-- постоянный grandfather-доступ к показу и редактированию.
ALTER TABLE "QRCode" ADD COLUMN "landingGrandfathered" BOOLEAN NOT NULL DEFAULT false;

UPDATE "QRCode" SET "landingGrandfathered" = true WHERE "mode" = 'LANDING';
