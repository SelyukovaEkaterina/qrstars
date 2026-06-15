-- QR-коды из ЛК сразу активны; isActive=false остаётся только для неактивированных табличек (MARKETPLACE).
UPDATE "QRCode"
SET "isActive" = true
WHERE "source" = 'DASHBOARD' AND "isActive" = false;
