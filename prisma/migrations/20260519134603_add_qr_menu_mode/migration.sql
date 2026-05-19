-- AlterEnum
ALTER TYPE "QRCodeMode" ADD VALUE 'MENU';

-- AlterTable
ALTER TABLE "QRCode" ADD COLUMN     "menuId" TEXT;

-- CreateTable
CREATE TABLE "QRMenu" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRMenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "menuId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRMenuItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "QRMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRMenuItem" ADD CONSTRAINT "QRMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "QRMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
