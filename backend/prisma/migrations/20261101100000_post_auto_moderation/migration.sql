CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');
CREATE TYPE "ModerationCategory" AS ENUM ('DIRECT_SALE', 'SEXUAL_CONTENT', 'HARASSMENT', 'PROVOCATION', 'OFF_TOPIC');

ALTER TYPE "NotificationType" ADD VALUE 'TEAM_MODERATION_ALERT';

ALTER TABLE "User" ADD COLUMN "accountStatusReason" TEXT;

CREATE TABLE "PostModerationCase" (
    "id" TEXT NOT NULL,
    "category" "ModerationCategory" NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "confidence" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostModerationCase_status_createdAt_idx" ON "PostModerationCase"("status", "createdAt");
CREATE INDEX "PostModerationCase_subjectId_status_createdAt_idx" ON "PostModerationCase"("subjectId", "status", "createdAt");
CREATE INDEX "PostModerationCase_postId_status_idx" ON "PostModerationCase"("postId", "status");

ALTER TABLE "PostModerationCase" ADD CONSTRAINT "PostModerationCase_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostModerationCase" ADD CONSTRAINT "PostModerationCase_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostModerationCase" ADD CONSTRAINT "PostModerationCase_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
