CREATE TABLE "ProjectCoBuildingState" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "state" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectCoBuildingState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectCoBuildingState_projectId_key"
ON "ProjectCoBuildingState"("projectId");

ALTER TABLE "ProjectCoBuildingState"
ADD CONSTRAINT "ProjectCoBuildingState_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
