-- CreateTable
CREATE TABLE "CustomPage" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "menuItemLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN "moduleOrder" JSONB;

-- CreateIndex
CREATE INDEX "CustomPage_establishmentId_idx" ON "CustomPage"("establishmentId");

-- AddForeignKey
ALTER TABLE "CustomPage" ADD CONSTRAINT "CustomPage_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
