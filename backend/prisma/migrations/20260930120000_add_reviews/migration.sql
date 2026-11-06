CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "Review_userId_targetId_key" ON "Review"("userId", "targetId");
CREATE INDEX "Review_targetId_createdAt_idx" ON "Review"("targetId", "createdAt");
CREATE INDEX "Review_targetId_rating_createdAt_idx" ON "Review"("targetId", "rating", "createdAt");

ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;