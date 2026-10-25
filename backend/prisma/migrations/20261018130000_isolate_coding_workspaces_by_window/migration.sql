ALTER TABLE "CodingWorkspace"
ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'legacy';

DROP INDEX "CodingWorkspace_ownerId_key";

CREATE UNIQUE INDEX "CodingWorkspace_ownerId_clientId_key"
ON "CodingWorkspace"("ownerId", "clientId");
