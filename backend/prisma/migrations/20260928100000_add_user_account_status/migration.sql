CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

ALTER TABLE "User"
ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "suspendedUntil" TIMESTAMP(3);

CREATE INDEX "User_accountStatus_suspendedUntil_idx" ON "User"("accountStatus", "suspendedUntil");