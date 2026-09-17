-- Пробный PRO: маркер выдачи на пользователе и признак триала на подписке
ALTER TABLE "User" ADD COLUMN "proTrialStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "firstPaidAccessAt" TIMESTAMP(3);

ALTER TABLE "Subscription" ADD COLUMN "isTrial" BOOLEAN NOT NULL DEFAULT false;

-- Бывшие платные владельцы не должны терять опубликованный микросайт:
-- проставляем дату первой платной подписки (любой статус).
UPDATE "User" u
SET "firstPaidAccessAt" = s."firstPaid"
FROM (
  SELECT "userId", MIN("createdAt") AS "firstPaid"
  FROM "Subscription"
  WHERE "plan" IN ('PRO', 'NETWORK')
  GROUP BY "userId"
) s
WHERE s."userId" = u."id";
