-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentOrderKind" AS ENUM ('INITIAL', 'RENEWAL');

-- AlterTable Subscription
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "yookassaPaymentId";
ALTER TABLE "Subscription" ADD COLUMN "invoiceId" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "parentInvoiceId" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "billing" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "renewalAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "renewalNoticeSentAt" TIMESTAMP(3);

-- CreateTable PaymentOrder
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "invId" SERIAL NOT NULL,
    "kind" "PaymentOrderKind" NOT NULL DEFAULT 'INITIAL',
    "parentInvId" INTEGER,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "billing" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "consentLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable RecurringConsentLog
CREATE TABLE "RecurringConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "billing" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "offerUrl" TEXT NOT NULL,
    "offerVersion" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "paymentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_invId_key" ON "PaymentOrder"("invId");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_status_idx" ON "PaymentOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_kind_idx" ON "PaymentOrder"("status", "kind");

-- CreateIndex
CREATE INDEX "RecurringConsentLog_userId_idx" ON "RecurringConsentLog"("userId");

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConsentLog" ADD CONSTRAINT "RecurringConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
