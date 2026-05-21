ALTER TABLE "User" ADD COLUMN "referralCode" TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;

CREATE TABLE "PartnerEarning" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "description" TEXT,
    "partnerId" TEXT NOT NULL,
    "referralUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerEarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerWithdrawal" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recepientName" TEXT NOT NULL,
    "recepientInn" TEXT NOT NULL,
    "recepientType" TEXT NOT NULL,
    "bankName" TEXT,
    "bankBik" TEXT,
    "bankAccount" TEXT,
    "corrAccount" TEXT,
    "comment" TEXT,
    "adminComment" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerWithdrawal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_referralUserId_fkey" FOREIGN KEY ("referralUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerWithdrawal" ADD CONSTRAINT "PartnerWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
