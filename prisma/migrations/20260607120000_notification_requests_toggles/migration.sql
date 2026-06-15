-- Split notification toggles: reviews (existing *Enabled) vs requests (new fields)
ALTER TABLE "Establishment" ADD COLUMN "notificationEmailRequestsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Establishment" ADD COLUMN "notificationTelegramRequestsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Establishment" ADD COLUMN "notificationMaxRequestsEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Establishment"
SET
  "notificationEmailRequestsEnabled" = "notificationEmailEnabled",
  "notificationTelegramRequestsEnabled" = "notificationTelegramEnabled",
  "notificationMaxRequestsEnabled" = "notificationMaxEnabled";
