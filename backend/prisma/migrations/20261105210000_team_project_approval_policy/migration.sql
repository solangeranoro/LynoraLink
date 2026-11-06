UPDATE "Project"
SET "moderationStatus" = 'APPROVED',
    "reviewedBy" = NULL,
    "reviewDate" = NULL
WHERE "parentTeamId" IS NULL;

UPDATE "Project"
SET "moderationStatus" = 'PENDING',
    "reviewedBy" = NULL,
    "reviewDate" = NULL
WHERE "parentTeamId" IS NOT NULL
  AND "moderationStatus" <> 'APPROVED';

ALTER TABLE "Project"
ALTER COLUMN "moderationStatus" SET DEFAULT 'APPROVED';
