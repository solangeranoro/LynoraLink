CREATE TABLE "AiSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiSession_userId_createdAt_idx" ON "AiSession"("userId", "createdAt");

ALTER TABLE "AiSession" ADD CONSTRAINT "AiSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;