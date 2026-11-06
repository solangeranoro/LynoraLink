INSERT INTO "Post" ("id", "type", "content", "authorId", "projectId", "teamId", "createdAt", "updatedAt")
SELECT
  'c' || substr(md5(project."id" || clock_timestamp()::text), 1, 24),
  'PROJECT',
  project."description",
  project."creatorId",
  project."id",
  project."parentTeamId",
  project."createdAt",
  project."createdAt"
FROM "Project" project
WHERE project."teamName" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Post" post
    WHERE post."projectId" = project."id"
      AND post."type" = 'PROJECT'
  );
