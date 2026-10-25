UPDATE "Subscription"
SET "paymentProvider" = 'LEGACY'
WHERE "paymentProvider" <> 'FEDAPAY';

DROP INDEX "Subscription_paypalSubscriptionId_key";

ALTER TABLE "Subscription"
  DROP COLUMN "paypalSubscriptionId",
  DROP COLUMN "paypalPayerId",
  ADD COLUMN "fedapayTransactionId" TEXT;

CREATE UNIQUE INDEX "Subscription_fedapayTransactionId_key"
  ON "Subscription"("fedapayTransactionId");
