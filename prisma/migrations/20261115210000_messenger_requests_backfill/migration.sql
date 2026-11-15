-- С 2026-11-15 привязка Telegram / MAX включает в проектах владельца и жалобы, и заявки
-- (ответы форм, заказы из меню, заявки с визитки). Раньше включались только жалобы.
-- Догоняем тех, кто привязал канал раньше: заявки включаем, только если жалобы в этом
-- канале не выключены владельцем (его явный выбор не трогаем). Идемпотентно.

UPDATE "Establishment" e
SET "notificationTelegramRequestsEnabled" = true
WHERE e."notificationTelegramRequestsEnabled" = false
  AND e."notificationTelegramEnabled" = true
  AND (
    e."notificationTelegramChatId" IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM "MessengerContact" m
      WHERE m."userId" = e."userId" AND m."provider" = 'TELEGRAM'
    )
  );

UPDATE "Establishment" e
SET "notificationMaxRequestsEnabled" = true
WHERE e."notificationMaxRequestsEnabled" = false
  AND e."notificationMaxEnabled" = true
  AND (
    e."notificationMaxUserId" IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM "MessengerContact" m
      WHERE m."userId" = e."userId" AND m."provider" = 'MAX'
    )
  );
