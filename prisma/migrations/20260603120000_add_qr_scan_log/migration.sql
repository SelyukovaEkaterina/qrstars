-- CreateTable
CREATE TABLE "QRScan" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "establishmentId" TEXT,
    "ip" TEXT,
    "region" TEXT,
    "browser" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QRScan_qrCodeId_createdAt_idx" ON "QRScan"("qrCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "QRScan_establishmentId_createdAt_idx" ON "QRScan"("establishmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "QRScan" ADD CONSTRAINT "QRScan_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
