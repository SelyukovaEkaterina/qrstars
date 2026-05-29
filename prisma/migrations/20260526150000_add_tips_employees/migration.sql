-- CreateTable
CREATE TABLE "TipsEmployee" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "paymentType" TEXT NOT NULL DEFAULT 'PHONE',
    "paymentUrl" TEXT,
    "phone" TEXT,
    "bankName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipsEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TipsEmployee_qrCodeId_idx" ON "TipsEmployee"("qrCodeId");

-- AddForeignKey
ALTER TABLE "TipsEmployee" ADD CONSTRAINT "TipsEmployee_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
