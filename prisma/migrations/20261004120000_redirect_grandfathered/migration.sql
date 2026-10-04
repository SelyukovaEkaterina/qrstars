-- Экран QrStars перед внешним переходом на FREE показывается только для QR,
-- созданных после этой миграции. Уже напечатанные коды ведут напрямую.
ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "redirectGrandfathered" BOOLEAN NOT NULL DEFAULT false;

UPDATE "QRCode" SET "redirectGrandfathered" = true;
