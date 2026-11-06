ALTER TABLE "User"
    ADD COLUMN "lynaiPremium" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "LemonSqueezySubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerPortalUrl" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "eventCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LemonSqueezySubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceVendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceVendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LemonSqueezySubscription_userId_key" ON "LemonSqueezySubscription"("userId");
CREATE UNIQUE INDEX "LemonSqueezySubscription_subscriptionId_key" ON "LemonSqueezySubscription"("subscriptionId");
CREATE INDEX "LemonSqueezySubscription_status_currentPeriodEnd_idx" ON "LemonSqueezySubscription"("status", "currentPeriodEnd");
CREATE UNIQUE INDEX "MarketplaceVendor_userId_key" ON "MarketplaceVendor"("userId");
CREATE UNIQUE INDEX "MarketplaceVendor_stripeAccountId_key" ON "MarketplaceVendor"("stripeAccountId");
CREATE INDEX "MarketplaceVendor_chargesEnabled_payoutsEnabled_detailsSubmitted_idx" ON "MarketplaceVendor"("chargesEnabled", "payoutsEnabled", "detailsSubmitted");

ALTER TABLE "LemonSqueezySubscription"
    ADD CONSTRAINT "LemonSqueezySubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceVendor"
    ADD CONSTRAINT "MarketplaceVendor_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "User" SET "lynaiPremium" = TRUE
WHERE "id" IN (
    SELECT "userId" FROM "LynoAISubscription"
    WHERE "status" IN ('active', 'trialing')
);
