-- AlterTable
ALTER TABLE "User" ADD COLUMN "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "registrationSource" TEXT;
ALTER TABLE "User" ADD COLUMN "firstScanAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserLifecycleEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLifecycleEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "npsScore" INTEGER NOT NULL,
    "comment" TEXT,
    "contactOk" BOOLEAN NOT NULL DEFAULT false,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLifecycleEmail_campaignKey_sentAt_idx" ON "UserLifecycleEmail"("campaignKey", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserLifecycleEmail_userId_campaignKey_key" ON "UserLifecycleEmail"("userId", "campaignKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserFeedback_userId_key" ON "UserFeedback"("userId");

-- AddForeignKey
ALTER TABLE "UserLifecycleEmail" ADD CONSTRAINT "UserLifecycleEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
