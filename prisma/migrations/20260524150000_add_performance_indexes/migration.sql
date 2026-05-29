-- Performance indexes

-- QRCode: fast lookup by establishment
CREATE INDEX "QRCode_establishmentId_idx" ON "QRCode"("establishmentId");
-- QRCode: admin/dashboard filter by active state
CREATE INDEX "QRCode_isActive_establishmentId_idx" ON "QRCode"("isActive", "establishmentId");

-- Subscription: every scan checks active sub for PRO status
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- Review: analytics queries filter by establishment + date range
CREATE INDEX "Review_establishmentId_createdAt_idx" ON "Review"("establishmentId", "createdAt");

-- PartnerEarning: partner dashboard filters by partner + status
CREATE INDEX "PartnerEarning_partnerId_status_idx" ON "PartnerEarning"("partnerId", "status");
