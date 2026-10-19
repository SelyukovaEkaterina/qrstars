-- Персональный код на первый год PRO
CREATE TABLE "SubscriptionIntroOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "campaignKey" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "billing" TEXT NOT NULL DEFAULT 'yearly',
    "amountRub" INTEGER NOT NULL,
    "listAmountRub" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "paymentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionIntroOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionIntroOffer_code_key" ON "SubscriptionIntroOffer"("code");

CREATE UNIQUE INDEX "SubscriptionIntroOffer_userId_campaignKey_key" ON "SubscriptionIntroOffer"("userId", "campaignKey");

CREATE INDEX "SubscriptionIntroOffer_expiresAt_idx" ON "SubscriptionIntroOffer"("expiresAt");

ALTER TABLE "SubscriptionIntroOffer" ADD CONSTRAINT "SubscriptionIntroOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Первый скан раньше этой отсечки письмо не получает (19 октября 2026, 00:00 МСК).
INSERT INTO "PlatformMeta" ("key", "value", "updatedAt")
VALUES ('pro_offer_campaign_started_at', '2026-10-18T21:00:00.000Z', NOW())
ON CONFLICT ("key") DO NOTHING;
