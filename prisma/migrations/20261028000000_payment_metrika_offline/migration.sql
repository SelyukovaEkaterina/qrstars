-- Офлайн-конверсия payment_success в Метрику: отметка об отправке оплаты
ALTER TABLE "PaymentOrder" ADD COLUMN "metrikaOfflineSentAt" TIMESTAMP(3);
