ALTER TABLE "AiSession"
ADD COLUMN "conversationId" TEXT;

UPDATE "AiSession"
SET "conversationId" = 'legacy_' || "userId"
WHERE "conversationId" IS NULL;

CREATE INDEX "AiSession_userId_conversationId_createdAt_idx"
ON "AiSession"("userId", "conversationId", "createdAt");
