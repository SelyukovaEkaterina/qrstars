-- CreateEnum
CREATE TYPE "MessengerProvider" AS ENUM ('TELEGRAM', 'MAX');

-- CreateTable
CREATE TABLE "MessengerContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MessengerProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessengerContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessengerContact_userId_provider_externalId_key" ON "MessengerContact"("userId", "provider", "externalId");

ALTER TABLE "MessengerContact" ADD CONSTRAINT "MessengerContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate Telegram contacts from BusinessCard
INSERT INTO "MessengerContact" ("id", "userId", "provider", "externalId", "label", "createdAt", "updatedAt")
SELECT DISTINCT ON (bc."userId", bc."contactTelegramChatId")
    md5(bc."userId" || ':tg:' || bc."contactTelegramChatId"),
    bc."userId",
    'TELEGRAM'::"MessengerProvider",
    bc."contactTelegramChatId",
    'Telegram',
    NOW(),
    NOW()
FROM "BusinessCard" bc
WHERE bc."contactTelegramChatId" IS NOT NULL
  AND bc."contactTelegramEnabled" = true;

-- Migrate MAX contacts from BusinessCard
INSERT INTO "MessengerContact" ("id", "userId", "provider", "externalId", "label", "createdAt", "updatedAt")
SELECT DISTINCT ON (bc."userId", bc."contactMaxUserId")
    md5(bc."userId" || ':max:' || bc."contactMaxUserId"),
    bc."userId",
    'MAX'::"MessengerProvider",
    bc."contactMaxUserId",
    'MAX',
    NOW(),
    NOW()
FROM "BusinessCard" bc
WHERE bc."contactMaxUserId" IS NOT NULL
  AND bc."contactMaxEnabled" = true
  AND NOT EXISTS (
    SELECT 1 FROM "MessengerContact" mc
    WHERE mc."userId" = bc."userId"
      AND mc."provider" = 'MAX'
      AND mc."externalId" = bc."contactMaxUserId"
  );

-- AlterTable BusinessCard: add contactMessengerId
ALTER TABLE "BusinessCard" ADD COLUMN "contactMessengerId" TEXT;

-- Link business cards to migrated Telegram contacts (prefer telegram over max)
UPDATE "BusinessCard" bc
SET "contactMessengerId" = mc."id"
FROM "MessengerContact" mc
WHERE bc."contactEnabled" = true
  AND bc."contactTelegramChatId" IS NOT NULL
  AND bc."contactTelegramEnabled" = true
  AND mc."userId" = bc."userId"
  AND mc."provider" = 'TELEGRAM'
  AND mc."externalId" = bc."contactTelegramChatId";

-- Link remaining cards that only had MAX
UPDATE "BusinessCard" bc
SET "contactMessengerId" = mc."id"
FROM "MessengerContact" mc
WHERE bc."contactMessengerId" IS NULL
  AND bc."contactEnabled" = true
  AND bc."contactMaxUserId" IS NOT NULL
  AND bc."contactMaxEnabled" = true
  AND mc."userId" = bc."userId"
  AND mc."provider" = 'MAX'
  AND mc."externalId" = bc."contactMaxUserId";

-- Drop old columns
ALTER TABLE "BusinessCard" DROP COLUMN "contactTelegramChatId",
DROP COLUMN "contactTelegramEnabled",
DROP COLUMN "contactMaxUserId",
DROP COLUMN "contactMaxEnabled";

ALTER TABLE "BusinessCard" ADD CONSTRAINT "BusinessCard_contactMessengerId_fkey" FOREIGN KEY ("contactMessengerId") REFERENCES "MessengerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
