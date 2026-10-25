CREATE TYPE "CodingWorkspaceRole" AS ENUM ('CONTRIBUTOR', 'OBSERVER');

ALTER TABLE "ProjectCollaborator"
ADD COLUMN "codingRole" "CodingWorkspaceRole" NOT NULL DEFAULT 'CONTRIBUTOR';

ALTER TABLE "CodingWorkspace"
ADD COLUMN "teamId" TEXT;

CREATE UNIQUE INDEX "CodingWorkspace_teamId_key" ON "CodingWorkspace"("teamId");

ALTER TABLE "CodingWorkspace"
ADD CONSTRAINT "CodingWorkspace_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CodingFileVersion" (
  "id" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CodingFileVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CodingFileVersion_fileId_createdAt_idx"
ON "CodingFileVersion"("fileId", "createdAt");

ALTER TABLE "CodingFileVersion"
ADD CONSTRAINT "CodingFileVersion_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "CodingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodingFileVersion"
ADD CONSTRAINT "CodingFileVersion_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CodingWorkspaceMessage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CodingWorkspaceMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CodingWorkspaceMessage_workspaceId_createdAt_idx"
ON "CodingWorkspaceMessage"("workspaceId", "createdAt");

ALTER TABLE "CodingWorkspaceMessage"
ADD CONSTRAINT "CodingWorkspaceMessage_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "CodingWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodingWorkspaceMessage"
ADD CONSTRAINT "CodingWorkspaceMessage_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
