CREATE TYPE "InteractionType" AS ENUM ('POST', 'COMMENT', 'PROJECT', 'TEAM', 'POLL', 'FEEDBACK', 'LIKE', 'LIVE_SESSION');

CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");
CREATE INDEX "UserBadge_userId_awardedAt_idx" ON "UserBadge"("userId", "awardedAt");
CREATE UNIQUE INDEX "Interaction_eventKey_key" ON "Interaction"("eventKey");
CREATE INDEX "Interaction_userId_createdAt_idx" ON "Interaction"("userId", "createdAt");
CREATE INDEX "Interaction_type_createdAt_idx" ON "Interaction"("type", "createdAt");

ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey"
FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Badge" ("id", "key", "name", "icon", "criteria") VALUES
  (md5(random()::text || clock_timestamp()::text), 'TOP_MAKER', 'Top Maker', 'Trophy', 'top_5_percent_active_90d'),
  (md5(random()::text || clock_timestamp()::text), 'EARLY_LAUNCHER', 'Early Launcher', 'Rocket', 'at_least_one_launched_project'),
  (md5(random()::text || clock_timestamp()::text), 'MENTOR', 'Mentor', 'GraduationCap', 'at_least_five_feedback_entries'),
  (md5(random()::text || clock_timestamp()::text), 'CO_BUILDER', 'Co-builder', 'Flame', 'approved_collaborations_on_three_projects'),
  (md5(random()::text || clock_timestamp()::text), 'COMMUNITY_STAR', 'Community Star', 'Star', 'one_post_with_ten_reactions_or_comments'),
  (md5(random()::text || clock_timestamp()::text), 'EXPLORER', 'Explorer', 'Compass', 'five_poll_votes_and_three_feedback_entries');

INSERT INTO "Interaction" ("id", "eventKey", "userId", "type", "targetId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), 'POST:' || "authorId" || ':' || "id", "authorId", 'POST'::"InteractionType", "id", "createdAt" FROM "Post"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'COMMENT:' || "authorId" || ':' || "id", "authorId", 'COMMENT'::"InteractionType", "id", "createdAt" FROM "Comment"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'PROJECT:' || "creatorId" || ':' || "id", "creatorId", 'PROJECT'::"InteractionType", "id", "createdAt" FROM "Project"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'PROJECT_UPDATE:' || "creatorId" || ':' || "id" || ':' || extract(epoch FROM "updatedAt"), "creatorId", 'PROJECT'::"InteractionType", "id", "updatedAt"
FROM "Project" WHERE "updatedAt" > "createdAt"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'TEAM:' || "userId" || ':' || "id", "userId", 'TEAM'::"InteractionType", "id", "updatedAt"
FROM "ProjectCollaborator" WHERE "status" = 'APPROVED' AND "role" <> 'FOUNDER'
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'TEAM_TASK_CREATE:' || "creatorId" || ':' || "id", "creatorId", 'TEAM'::"InteractionType", "id", "createdAt" FROM "ProjectTask"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'TEAM_INVITE:' || "invitedById" || ':' || "id", "invitedById", 'TEAM'::"InteractionType", "id", "createdAt"
FROM "ProjectCollaborator" WHERE "invitedById" IS NOT NULL
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'POLL_CREATE:' || "Post"."authorId" || ':' || "Poll"."id", "Post"."authorId", 'POLL'::"InteractionType", "Poll"."id", "Poll"."createdAt"
FROM "Poll" JOIN "Post" ON "Post"."id" = "Poll"."postId"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'POLL:' || "userId" || ':' || "pollId", "userId", 'POLL'::"InteractionType", "pollId", "createdAt" FROM "PollVote"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'FEEDBACK:' || "authorId" || ':' || "id", "authorId", 'FEEDBACK'::"InteractionType", "id", "createdAt" FROM "ProjectFeedback"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'LIKE:' || "userId" || ':' || "postId", "userId", 'LIKE'::"InteractionType", "postId", "createdAt" FROM "Like"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'LIVE_SESSION_HOST:' || "hostId" || ':' || "id", "hostId", 'LIVE_SESSION'::"InteractionType", "id", "createdAt" FROM "LiveEvent"
UNION ALL
SELECT md5(random()::text || clock_timestamp()::text), 'LIVE_SESSION_BOOKING:' || "userId" || ':' || "id", "userId", 'LIVE_SESSION'::"InteractionType", "id", "createdAt"
FROM "LiveEventBooking" WHERE "status" = 'CONFIRMED';