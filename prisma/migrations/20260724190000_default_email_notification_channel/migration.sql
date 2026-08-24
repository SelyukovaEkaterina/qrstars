-- Email регистрации — канал уведомлений по умолчанию (отзывы + заявки).

ALTER TABLE "Establishment" ALTER COLUMN "notificationEmailEnabled" SET DEFAULT true;
ALTER TABLE "Establishment" ALTER COLUMN "notificationEmailRequestsEnabled" SET DEFAULT true;

-- Пользователи без любого EMAIL-контакта → создаём contact = user.email и включаем тумблеры
WITH users_without_email_contact AS (
  SELECT u.id AS "userId", lower(trim(u.email)) AS email
  FROM "User" u
  WHERE u.email IS NOT NULL
    AND trim(u.email) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM "MessengerContact" mc
      WHERE mc."userId" = u.id
        AND mc."provider" = 'EMAIL'
    )
),
ins AS (
  INSERT INTO "MessengerContact" ("id", "userId", "provider", "externalId", "label", "createdAt", "updatedAt")
  SELECT
    md5(w."userId" || ':email:' || w.email),
    w."userId",
    'EMAIL'::"MessengerProvider",
    w.email,
    w.email,
    NOW(),
    NOW()
  FROM users_without_email_contact w
  RETURNING "userId"
)
UPDATE "Establishment" e
SET
  "notificationEmailEnabled" = true,
  "notificationEmailRequestsEnabled" = true
WHERE e."userId" IN (SELECT "userId" FROM ins);

-- Если EMAIL-контакт с адресом регистрации отсутствует, но другие EMAIL уже есть —
-- просто добавим адрес регистрации (тумблеры не трогаем)
INSERT INTO "MessengerContact" ("id", "userId", "provider", "externalId", "label", "createdAt", "updatedAt")
SELECT
  md5(u.id || ':email:' || lower(trim(u.email))),
  u.id,
  'EMAIL'::"MessengerProvider",
  lower(trim(u.email)),
  lower(trim(u.email)),
  NOW(),
  NOW()
FROM "User" u
WHERE u.email IS NOT NULL
  AND trim(u.email) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "MessengerContact" mc
    WHERE mc."userId" = u.id
      AND mc."provider" = 'EMAIL'
      AND mc."externalId" = lower(trim(u.email))
  );
