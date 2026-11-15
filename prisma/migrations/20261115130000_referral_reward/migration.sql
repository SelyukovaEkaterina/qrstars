ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "giftReason" TEXT;

CREATE TABLE IF NOT EXISTS "ReferralReward" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "invId" INTEGER NOT NULL,
    "plan" "Plan" NOT NULL,
    "referrerDays" INTEGER NOT NULL,
    "friendDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralReward_friendId_key" ON "ReferralReward"("friendId");
CREATE INDEX IF NOT EXISTS "ReferralReward_referrerId_idx" ON "ReferralReward"("referrerId");

ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
