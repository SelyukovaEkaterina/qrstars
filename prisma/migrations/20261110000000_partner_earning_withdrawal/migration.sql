-- Начисление помнит заявку на вывод: при отказе (REJECTED) его можно вернуть в AVAILABLE.
ALTER TABLE "PartnerEarning" ADD COLUMN "withdrawalId" TEXT;

CREATE INDEX "PartnerEarning_withdrawalId_idx" ON "PartnerEarning"("withdrawalId");

ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "PartnerWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
