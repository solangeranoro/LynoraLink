CREATE TYPE "TwoFactorPurpose" AS ENUM ('LOGIN', 'ENABLE', 'DISABLE');

ALTER TABLE "User"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TwoFactorChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "TwoFactorPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwoFactorChallenge_userId_purpose_key"
ON "TwoFactorChallenge"("userId", "purpose");

CREATE INDEX "TwoFactorChallenge_expiresAt_idx"
ON "TwoFactorChallenge"("expiresAt");

ALTER TABLE "TwoFactorChallenge"
ADD CONSTRAINT "TwoFactorChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;