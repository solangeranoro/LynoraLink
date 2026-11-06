CREATE TABLE "PaddleCopilotSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paddleSubscriptionId" TEXT NOT NULL,
    "paddleCustomerId" TEXT,
    "priceId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaddleCopilotSubscription_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MarketplaceItem"
    ADD COLUMN "paddleProductId" TEXT,
    ADD COLUMN "paddlePriceId" TEXT;

ALTER TABLE "PaddleCopilotSubscription"
    ADD COLUMN "customerPortalUrl" TEXT;

ALTER TABLE "MarketplaceVerification"
    ADD COLUMN "customerPortalUrl" TEXT;

CREATE UNIQUE INDEX "PaddleCopilotSubscription_userId_key" ON "PaddleCopilotSubscription"("userId");
CREATE UNIQUE INDEX "PaddleCopilotSubscription_paddleSubscriptionId_key" ON "PaddleCopilotSubscription"("paddleSubscriptionId");
CREATE INDEX "PaddleCopilotSubscription_status_currentPeriodEnd_idx" ON "PaddleCopilotSubscription"("status", "currentPeriodEnd");

ALTER TABLE "PaddleCopilotSubscription"
    ADD CONSTRAINT "PaddleCopilotSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
