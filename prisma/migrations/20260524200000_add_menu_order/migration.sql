-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MenuOrderStatus" AS ENUM ('NEW', 'ACCEPTED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "MenuOrder" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "qrCodeId" TEXT,
    "items" JSONB NOT NULL,
    "total" DOUBLE PRECISION,
    "totalText" TEXT,
    "guestName" TEXT NOT NULL,
    "tableNumber" TEXT,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "guestAddress" TEXT,
    "comment" TEXT,
    "guestIp" TEXT,
    "guestRegion" TEXT,
    "guestBrowser" TEXT,
    "guestDevice" TEXT,
    "status" "MenuOrderStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuOrder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys (idempotent)
DO $$ BEGIN
  ALTER TABLE "MenuOrder" ADD CONSTRAINT "MenuOrder_establishmentId_fkey"
    FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MenuOrder" ADD CONSTRAINT "MenuOrder_qrCodeId_fkey"
    FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndexes (idempotent)
CREATE INDEX IF NOT EXISTS "MenuOrder_establishmentId_createdAt_idx" ON "MenuOrder"("establishmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "MenuOrder_status_idx" ON "MenuOrder"("status");
