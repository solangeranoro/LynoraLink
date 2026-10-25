ALTER TABLE "LynoAIUsageEvent"
    ADD COLUMN "actionType" TEXT NOT NULL DEFAULT 'legacy_usage',
    ADD COLUMN "countsTowardQuota" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX "LynoAIUsageEvent_userId_countsTowardQuota_createdAt_idx"
    ON "LynoAIUsageEvent"("userId", "countsTowardQuota", "createdAt");
