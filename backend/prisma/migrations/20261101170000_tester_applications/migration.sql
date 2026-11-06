CREATE TYPE "TesterApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TesterApplicationPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'DESKTOP');
CREATE TYPE "TesterApplicationActivityType" AS ENUM ('BUG_REPORT', 'REVIEW', 'COMMENT', 'POLL');
CREATE TYPE "TesterApplicationBugStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
ALTER TYPE "NotificationType" ADD VALUE 'TESTER_APPLICATION_SUBMITTED';

CREATE TABLE "TesterApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problem" TEXT,
    "logoUrl" TEXT,
    "screenshotUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "platform" "TesterApplicationPlatform" NOT NULL,
    "createdDate" TIMESTAMP(3),
    "websiteUrl" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "technologies" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerTitle" TEXT NOT NULL,
    "ownerCity" TEXT NOT NULL,
    "ownerCountry" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "ownerAddress" TEXT NOT NULL,
    "status" "TesterApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TesterApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TesterApplicationActivity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "TesterApplicationActivityType" NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "rating" INTEGER,
    "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "bugStatus" "TesterApplicationBugStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TesterApplicationActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TesterApplicationPollVote" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesterApplicationPollVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TesterApplication_status_createdAt_idx" ON "TesterApplication"("status", "createdAt");
CREATE INDEX "TesterApplication_ownerId_createdAt_idx" ON "TesterApplication"("ownerId", "createdAt");
CREATE INDEX "TesterApplicationActivity_applicationId_type_createdAt_idx" ON "TesterApplicationActivity"("applicationId", "type", "createdAt");
CREATE INDEX "TesterApplicationActivity_authorId_idx" ON "TesterApplicationActivity"("authorId");
CREATE UNIQUE INDEX "TesterApplicationPollVote_activityId_userId_key" ON "TesterApplicationPollVote"("activityId", "userId");
CREATE INDEX "TesterApplicationPollVote_userId_idx" ON "TesterApplicationPollVote"("userId");

ALTER TABLE "TesterApplication" ADD CONSTRAINT "TesterApplication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TesterApplication" ADD CONSTRAINT "TesterApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TesterApplicationActivity" ADD CONSTRAINT "TesterApplicationActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TesterApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TesterApplicationActivity" ADD CONSTRAINT "TesterApplicationActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TesterApplicationPollVote" ADD CONSTRAINT "TesterApplicationPollVote_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TesterApplicationActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TesterApplicationPollVote" ADD CONSTRAINT "TesterApplicationPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
