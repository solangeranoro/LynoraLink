CREATE TABLE "LynoAIQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL DEFAULT 100,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LynoAIQuota_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LynoAISubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "stripeEventCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LynoAISubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LynoAIQuota_userId_platform_key" ON "LynoAIQuota"("userId", "platform");
CREATE INDEX "LynoAIQuota_resetAt_idx" ON "LynoAIQuota"("resetAt");
CREATE UNIQUE INDEX "LynoAISubscription_userId_key" ON "LynoAISubscription"("userId");
CREATE UNIQUE INDEX "LynoAISubscription_stripeSubscriptionId_key" ON "LynoAISubscription"("stripeSubscriptionId");

ALTER TABLE "LynoAIQuota" ADD CONSTRAINT "LynoAIQuota_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LynoAISubscription" ADD CONSTRAINT "LynoAISubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
