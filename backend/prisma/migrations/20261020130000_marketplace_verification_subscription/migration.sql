CREATE TABLE "MarketplaceVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_email',
    "emailToken" TEXT NOT NULL,
    "emailTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "subscriptionId" TEXT,
    "customerId" TEXT,
    "variantId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "eventCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceVerification_userId_key" ON "MarketplaceVerification"("userId");
CREATE UNIQUE INDEX "MarketplaceVerification_emailToken_key" ON "MarketplaceVerification"("emailToken");
CREATE UNIQUE INDEX "MarketplaceVerification_subscriptionId_key" ON "MarketplaceVerification"("subscriptionId");
CREATE INDEX "MarketplaceVerification_status_currentPeriodEnd_idx" ON "MarketplaceVerification"("status", "currentPeriodEnd");

ALTER TABLE "MarketplaceVerification"
    ADD CONSTRAINT "MarketplaceVerification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
