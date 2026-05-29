-- CreateEnum
CREATE TYPE "EstablishmentMemberStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateTable
CREATE TABLE "EstablishmentMember" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "status" "EstablishmentMemberStatus" NOT NULL DEFAULT 'PENDING',
    "inviteToken" TEXT,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "EstablishmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstablishmentMember_inviteToken_key" ON "EstablishmentMember"("inviteToken");

-- CreateIndex
CREATE INDEX "EstablishmentMember_userId_status_idx" ON "EstablishmentMember"("userId", "status");

-- CreateIndex
CREATE INDEX "EstablishmentMember_email_status_idx" ON "EstablishmentMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EstablishmentMember_establishmentId_email_key" ON "EstablishmentMember"("establishmentId", "email");

-- AddForeignKey
ALTER TABLE "EstablishmentMember" ADD CONSTRAINT "EstablishmentMember_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstablishmentMember" ADD CONSTRAINT "EstablishmentMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstablishmentMember" ADD CONSTRAINT "EstablishmentMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
