UPDATE "Subscription"
SET "paymentProvider" = 'LEGACY'
WHERE "paymentProvider" = 'FEDAPAY';

UPDATE "Boost"
SET "paymentProvider" = 'LEGACY'
WHERE "paymentProvider" = 'FEDAPAY';

UPDATE "MarketplaceOrder"
SET "paymentProvider" = 'LEGACY'
WHERE "paymentProvider" = 'FEDAPAY';

DROP INDEX IF EXISTS "Subscription_fedapayTransactionId_key";

ALTER TABLE "Subscription"
  DROP COLUMN IF EXISTS "fedapayTransactionId",
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key"
  ON "Subscription"("stripeSubscriptionId");

CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key"
  ON "Subscription"("stripeCustomerId");
