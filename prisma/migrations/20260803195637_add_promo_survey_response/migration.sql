-- DropIndex
DROP INDEX "EstablishmentMember_email_status_idx";

-- DropIndex
DROP INDEX "EstablishmentMember_userId_status_idx";

-- DropIndex
DROP INDEX "Form_establishmentId_idx";

-- DropIndex
DROP INDEX "FormField_formId_order_idx";

-- DropIndex
DROP INDEX "FormSubmission_formId_createdAt_idx";

-- DropIndex
DROP INDEX "MenuOrder_establishmentId_createdAt_idx";

-- DropIndex
DROP INDEX "MenuOrder_status_idx";

-- DropIndex
DROP INDEX "PartnerEarning_partnerId_status_idx";

-- DropIndex
DROP INDEX "QRCode_establishmentId_idx";

-- DropIndex
DROP INDEX "QRCode_isActive_establishmentId_idx";

-- DropIndex
DROP INDEX "Review_establishmentId_createdAt_idx";

-- DropIndex
DROP INDEX "Subscription_userId_status_idx";

-- DropIndex
DROP INDEX "SupportMessage_ticketId_createdAt_idx";

-- DropIndex
DROP INDEX "SupportTicket_telegramTopicId_idx";

-- DropIndex
DROP INDEX "SupportTicket_updatedAt_idx";

-- DropIndex
DROP INDEX "SupportTicket_userId_status_idx";

-- DropIndex
DROP INDEX "TipsEmployee_establishmentId_idx";

-- DropIndex
DROP INDEX "TipsEmployee_qrCodeId_idx";

-- AlterTable
ALTER TABLE "MenuOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PromoSurveyResponse" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "answers" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoSurveyResponse_email_key" ON "PromoSurveyResponse"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PromoSurveyResponse_userId_key" ON "PromoSurveyResponse"("userId");

-- AddForeignKey
ALTER TABLE "PromoSurveyResponse" ADD CONSTRAINT "PromoSurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
