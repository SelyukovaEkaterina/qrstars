-- UTM + Metrika ClientId at registration; offline conversion tracking per establishment
ALTER TABLE "User" ADD COLUMN "registrationUtm" JSONB;
ALTER TABLE "User" ADD COLUMN "metrikaClientId" TEXT;

ALTER TABLE "Establishment" ADD COLUMN "metrikaOfflineSentAt" TIMESTAMP(3);
