CREATE TABLE "ProductFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "pageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductFeedback_userId_createdAt_idx" ON "ProductFeedback"("userId", "createdAt");
CREATE INDEX "ProductFeedback_createdAt_idx" ON "ProductFeedback"("createdAt");

ALTER TABLE "ProductFeedback"
ADD CONSTRAINT "ProductFeedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
