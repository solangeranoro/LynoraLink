ALTER TABLE "Project"
ADD COLUMN "collaborationQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
