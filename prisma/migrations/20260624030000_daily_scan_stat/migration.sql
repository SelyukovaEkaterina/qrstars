-- CreateTable DailyScanStat
CREATE TABLE "DailyScanStat" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "establishmentId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "snapshot" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyScanStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyScanStat_qrCodeId_date_key" ON "DailyScanStat"("qrCodeId", "date");

-- CreateIndex
CREATE INDEX "DailyScanStat_date_idx" ON "DailyScanStat"("date");

-- CreateIndex
CREATE INDEX "DailyScanStat_establishmentId_date_idx" ON "DailyScanStat"("establishmentId", "date");

-- AddForeignKey
ALTER TABLE "DailyScanStat" ADD CONSTRAINT "DailyScanStat_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
