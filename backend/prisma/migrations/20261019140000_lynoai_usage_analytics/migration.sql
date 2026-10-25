CREATE TABLE "LynoAIUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LynoAIUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LynoAIUsageEvent_userId_createdAt_idx"
    ON "LynoAIUsageEvent"("userId", "createdAt");
CREATE INDEX "LynoAIUsageEvent_userId_platform_createdAt_idx"
    ON "LynoAIUsageEvent"("userId", "platform", "createdAt");

ALTER TABLE "LynoAIUsageEvent"
    ADD CONSTRAINT "LynoAIUsageEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
