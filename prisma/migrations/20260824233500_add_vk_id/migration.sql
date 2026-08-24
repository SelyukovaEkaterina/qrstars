ALTER TABLE "User" ADD COLUMN "vkId" TEXT;

CREATE UNIQUE INDEX "User_vkId_key" ON "User"("vkId");
