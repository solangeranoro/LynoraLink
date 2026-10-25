ALTER TABLE "User" DROP COLUMN "stripeAccountId";

UPDATE "Subscription"
SET "plan" = 'FREE',
    "status" = 'expired',
    "expiresAt" = CURRENT_TIMESTAMP
WHERE "stripeSubscriptionId" IS NOT NULL
   OR "stripeCustomerId" IS NOT NULL;

ALTER TABLE "Subscription"
  ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "paypalSubscriptionId" TEXT,
  ADD COLUMN "paypalPayerId" TEXT,
  DROP COLUMN "stripeCustomerId",
  DROP COLUMN "stripeSubscriptionId";
CREATE UNIQUE INDEX "Subscription_paypalSubscriptionId_key" ON "Subscription"("paypalSubscriptionId");

ALTER TABLE "Boost"
  RENAME COLUMN "stripeCheckoutSessionId" TO "paymentOrderId";
ALTER INDEX "Boost_stripeCheckoutSessionId_key" RENAME TO "Boost_paymentOrderId_key";
ALTER TABLE "Boost" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'LEGACY';

ALTER TABLE "MarketplaceOrder"
  RENAME COLUMN "stripeCheckoutSessionId" TO "paymentOrderId";
ALTER INDEX "MarketplaceOrder_stripeCheckoutSessionId_key" RENAME TO "MarketplaceOrder_paymentOrderId_key";
ALTER TABLE "MarketplaceOrder" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'LEGACY';

ALTER TABLE "LiveEventBooking"
  RENAME COLUMN "stripeCheckoutSessionId" TO "paymentOrderId";
ALTER INDEX "LiveEventBooking_stripeCheckoutSessionId_key" RENAME TO "LiveEventBooking_paymentOrderId_key";
ALTER TABLE "LiveEventBooking" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'LEGACY';

DROP TABLE "StripeWebhookEvent";

CREATE TABLE "PaymentCheckout" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentOrderId" TEXT,
  "kind" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "returnPath" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "PaymentCheckout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentCheckout_paymentOrderId_key" ON "PaymentCheckout"("paymentOrderId");
CREATE INDEX "PaymentCheckout_userId_status_createdAt_idx" ON "PaymentCheckout"("userId", "status", "createdAt");
ALTER TABLE "PaymentCheckout"
  ADD CONSTRAINT "PaymentCheckout_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
