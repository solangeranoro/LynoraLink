CREATE TYPE "PlanType" AS ENUM ('FREE', 'PREMIUM');
CREATE TYPE "MarketplaceItemType" AS ENUM ('TEMPLATE', 'MICRO_SAAS', 'SERVICE');
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED');
CREATE TYPE "LiveEventBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "User" ADD COLUMN "stripeAccountId" TEXT;
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_plan_status_expiresAt_idx" ON "Subscription"("plan", "status", "expiresAt");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Boost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Boost_stripeCheckoutSessionId_key" ON "Boost"("stripeCheckoutSessionId");
CREATE INDEX "Boost_projectId_expiresAt_idx" ON "Boost"("projectId", "expiresAt");
CREATE INDEX "Boost_userId_createdAt_idx" ON "Boost"("userId", "createdAt");
ALTER TABLE "Boost" ADD CONSTRAINT "Boost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Boost" ADD CONSTRAINT "Boost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketplaceItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MarketplaceItemType" NOT NULL DEFAULT 'TEMPLATE',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "imageUrl" TEXT,
    "deliveryUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketplaceItem_isActive_createdAt_idx" ON "MarketplaceItem"("isActive", "createdAt");
CREATE INDEX "MarketplaceItem_sellerId_idx" ON "MarketplaceItem"("sellerId");
ALTER TABLE "MarketplaceItem" ADD CONSTRAINT "MarketplaceItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketplaceOrder_stripeCheckoutSessionId_key" ON "MarketplaceOrder"("stripeCheckoutSessionId");
CREATE INDEX "MarketplaceOrder_buyerId_status_createdAt_idx" ON "MarketplaceOrder"("buyerId", "status", "createdAt");
CREATE INDEX "MarketplaceOrder_sellerId_status_createdAt_idx" ON "MarketplaceOrder"("sellerId", "status", "createdAt");
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MarketplaceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LiveEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "capacity" INTEGER,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiveEvent_isActive_startsAt_idx" ON "LiveEvent"("isActive", "startsAt");
CREATE INDEX "LiveEvent_hostId_idx" ON "LiveEvent"("hostId");
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LiveEventBooking" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "LiveEventBookingStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveEventBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiveEventBooking_stripeCheckoutSessionId_key" ON "LiveEventBooking"("stripeCheckoutSessionId");
CREATE INDEX "LiveEventBooking_eventId_status_idx" ON "LiveEventBooking"("eventId", "status");
CREATE INDEX "LiveEventBooking_eventId_status_expiresAt_idx" ON "LiveEventBooking"("eventId", "status", "expiresAt");
CREATE INDEX "LiveEventBooking_userId_status_idx" ON "LiveEventBooking"("userId", "status");
ALTER TABLE "LiveEventBooking" ADD CONSTRAINT "LiveEventBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveEventBooking" ADD CONSTRAINT "LiveEventBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);