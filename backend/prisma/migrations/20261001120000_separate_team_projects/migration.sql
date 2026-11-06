ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "parentTeamId" TEXT;

CREATE INDEX IF NOT EXISTS "Project_parentTeamId_idx" ON "Project"("parentTeamId");

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_parentTeamId_fkey') THEN
		ALTER TABLE "Project"
		ADD CONSTRAINT "Project_parentTeamId_fkey"
		FOREIGN KEY ("parentTeamId") REFERENCES "Project"("id")
		ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END $$;

DO $$
DECLARE
	team_row RECORD;
	project_id TEXT;
BEGIN
	FOR team_row IN SELECT * FROM "Project" WHERE "teamName" IS NOT NULL LOOP
		SELECT id INTO project_id
		FROM "Project"
		WHERE "parentTeamId" = team_row.id
		ORDER BY "createdAt" ASC
		LIMIT 1;

		IF project_id IS NULL THEN
			project_id := 'c' || substr(md5(team_row.id || clock_timestamp()::text), 1, 24);
			INSERT INTO "Project" (
				"id", "title", "slug", "tagline", "description", "status", "moderationStatus",
				"reviewedBy", "reviewDate", "isPrivate", "githubUrl", "liveUrl", "docsUrl",
				"pitchDeckUrl", "logoUrl", "coverUrl", "techStack", "tags", "lookingFor",
				"isFeatured", "creatorId", "parentTeamId", "createdAt", "updatedAt"
			) VALUES (
				project_id, team_row."title", team_row."slug" || '-project-' || substr(md5(team_row.id), 1, 8),
				team_row."tagline", team_row."description", team_row."status", team_row."moderationStatus",
				team_row."reviewedBy", team_row."reviewDate", team_row."isPrivate", team_row."githubUrl",
				team_row."liveUrl", team_row."docsUrl", team_row."pitchDeckUrl", team_row."logoUrl",
				team_row."coverUrl", team_row."techStack", team_row."tags", team_row."lookingFor",
				team_row."isFeatured", team_row."creatorId", team_row.id, team_row."createdAt", team_row."updatedAt"
			);
		END IF;

		INSERT INTO "ProjectCollaborator" (
			"id", "projectId", "userId", "invitedById", "role", "status", "message", "createdAt", "updatedAt"
		)
		SELECT
			'c' || substr(md5(pc.id || project_id), 1, 24), project_id, pc."userId", pc."invitedById",
			pc."role", pc."status", pc."message", pc."createdAt", COALESCE(pc."updatedAt", pc."createdAt")
		FROM "ProjectCollaborator" pc
		WHERE pc."projectId" = team_row.id
		ON CONFLICT ("projectId", "userId") DO NOTHING;

		UPDATE "Post"
		SET "projectId" = project_id,
				"teamId" = COALESCE("teamId", team_row.id)
		WHERE "projectId" = team_row.id AND "type" = 'PROJECT';

		IF NOT EXISTS (SELECT 1 FROM "Post" WHERE "projectId" = project_id AND "type" = 'PROJECT') THEN
			INSERT INTO "Post" ("id", "type", "content", "authorId", "projectId", "teamId", "createdAt", "updatedAt")
			VALUES (
				'c' || substr(md5(project_id || clock_timestamp()::text), 1, 24),
				'PROJECT', team_row."description", team_row."creatorId", project_id, team_row.id,
				team_row."createdAt", team_row."createdAt"
			);
		END IF;

		UPDATE "Project"
		SET "title" = team_row."teamName",
				"description" = COALESCE(team_row."teamDescription", team_row."description")
		WHERE "id" = team_row.id;
	END LOOP;
END $$;