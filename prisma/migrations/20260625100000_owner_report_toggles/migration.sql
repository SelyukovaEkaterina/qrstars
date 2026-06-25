-- AddColumn: тумблеры каналов для ежемесячного отчёта владельцу (owner-scoped)
ALTER TABLE "User" ADD COLUMN "reportsEmailEnabled"     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "reportsTelegramEnabled"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "reportsMaxEnabled"       BOOLEAN NOT NULL DEFAULT false;
