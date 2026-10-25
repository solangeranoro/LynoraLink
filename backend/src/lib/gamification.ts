import { InteractionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const badgeDefinitions = [
  { key: "TOP_MAKER", name: "Top Maker", icon: "Trophy", criteria: "top_5_percent_active_90d" },
  { key: "EARLY_LAUNCHER", name: "Early Launcher", icon: "Rocket", criteria: "at_least_one_launched_project" },
  { key: "MENTOR", name: "Mentor", icon: "GraduationCap", criteria: "at_least_five_feedback_entries" },
  { key: "CO_BUILDER", name: "Co-builder", icon: "Flame", criteria: "approved_collaborations_on_three_projects" },
  { key: "COMMUNITY_STAR", name: "Community Star", icon: "Star", criteria: "one_post_with_ten_reactions_or_comments" },
  { key: "EXPLORER", name: "Explorer", icon: "Compass", criteria: "five_poll_votes_and_three_feedback_entries" },
] as const;

export type BadgeKey = typeof badgeDefinitions[number]["key"];
export type AwardedBadge = {
  key: BadgeKey;
  name: string;
  icon: string;
  awardedAt: Date;
};

const activityWeights: Record<InteractionType, number> = {
  POST: 5,
  COMMENT: 3,
  PROJECT: 8,
  TEAM: 6,
  POLL: 2,
  FEEDBACK: 4,
  LIKE: 1,
  LIVE_SESSION: 5,
};
const ACTIVE_WINDOW_DAYS = 90;
const MIN_ACTIVE_SCORE = 10;
let badgeCatalogPromise: Promise<void> | undefined;

async function ensureBadgeCatalog() {
  if (!badgeCatalogPromise) {
    badgeCatalogPromise = Promise.all(badgeDefinitions.map((badge) => prisma.badge.upsert({
      where: { key: badge.key },
      create: badge,
      update: { name: badge.name, icon: badge.icon, criteria: badge.criteria },
    }))).then(() => undefined).catch((error) => {
      badgeCatalogPromise = undefined;
      throw error;
    });
  }
  await badgeCatalogPromise;
}

export async function recordInteraction(userId: string, type: InteractionType, targetId: string, eventKey = `${userId}:${type}:${targetId}`) {
  try {
    const { count } = await prisma.interaction.createMany({
      data: [{ userId, type, targetId, eventKey }],
      skipDuplicates: true,
    });
    if (count > 0) await syncUserBadges(userId);
  } catch (error) {
    console.error("Could not record maker interaction:", error);
  }
}

async function syncUserBadges(userId: string) {
  const [launchedProjects, collaborations, feedbackCount, pollVoteCount, posts] = await Promise.all([
    prisma.project.count({ where: { creatorId: userId, status: "LAUNCHED" } }),
    prisma.projectCollaborator.groupBy({
      by: ["projectId"],
      where: { userId, status: "APPROVED", role: { not: "FOUNDER" } },
    }),
    prisma.projectFeedback.count({ where: { authorId: userId } }),
    prisma.pollVote.count({ where: { userId } }),
    prisma.post.findMany({ where: { authorId: userId }, select: { id: true } }),
  ]);

  const postIds = posts.map(({ id }) => id);
  const [likesByPost, commentsByPost] = postIds.length
    ? await Promise.all([
      prisma.like.groupBy({ by: ["postId"], where: { postId: { in: postIds } }, _count: { _all: true } }),
      prisma.comment.groupBy({ by: ["postId"], where: { postId: { in: postIds } }, _count: { _all: true } }),
    ])
    : [[], []];
  const engagement = new Map<string, number>();
  for (const item of likesByPost) engagement.set(item.postId, item._count._all);
  for (const item of commentsByPost) engagement.set(item.postId, (engagement.get(item.postId) ?? 0) + item._count._all);

  const eligibleKeys = new Set<BadgeKey>();
  if (launchedProjects > 0) eligibleKeys.add("EARLY_LAUNCHER");
  if (feedbackCount >= 5) eligibleKeys.add("MENTOR");
  if (collaborations.length >= 3) eligibleKeys.add("CO_BUILDER");
  if ([...engagement.values()].some((count) => count >= 10)) eligibleKeys.add("COMMUNITY_STAR");
  if (pollVoteCount >= 5 && feedbackCount >= 3) eligibleKeys.add("EXPLORER");

  const badgeRows = await prisma.badge.findMany({ where: { key: { in: [...eligibleKeys] } }, select: { id: true } });
  if (badgeRows.length) {
    await prisma.userBadge.createMany({
      data: badgeRows.map(({ id }) => ({ userId, badgeId: id })),
      skipDuplicates: true,
    });
  }
}

export async function refreshUserBadges(userId: string) {
  try {
    await ensureBadgeCatalog();
    await syncUserBadges(userId);
  } catch (error) {
    console.error("Could not refresh maker badges:", error);
  }
}

async function getRankedMakers() {
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const activity = await prisma.interaction.groupBy({
    by: ["userId", "type"],
    where: { createdAt: { gte: activeSince } },
    _count: { _all: true },
  });
  const scores = new Map<string, number>();
  for (const item of activity) {
    scores.set(item.userId, (scores.get(item.userId) ?? 0) + item._count._all * activityWeights[item.type]);
  }
  const ranked = [...scores]
    .filter(([, score]) => score >= MIN_ACTIVE_SCORE)
    .sort(([firstId, firstScore], [secondId, secondScore]) => secondScore - firstScore || firstId.localeCompare(secondId));
  return ranked;
}

async function syncTopMakerBadges() {
  const ranked = await getRankedMakers();
  const awardCount = Math.ceil(ranked.length * 0.05);
  const topUserIds = ranked.slice(0, awardCount).map(([userId]) => userId);
  const badge = await prisma.badge.findUnique({ where: { key: "TOP_MAKER" }, select: { id: true } });
  if (!badge) return { ranked, topUserIds };

  await prisma.$transaction(async (transaction) => {
    await transaction.userBadge.deleteMany({
      where: { badgeId: badge.id, ...(topUserIds.length ? { userId: { notIn: topUserIds } } : {}) },
    });
    if (topUserIds.length) {
      await transaction.userBadge.createMany({
        data: topUserIds.map((userId) => ({ userId, badgeId: badge.id })),
        skipDuplicates: true,
      });
    }
  });
  return { ranked, topUserIds };
}

export async function getTopMakerCount() {
  const ranked = await getRankedMakers();
  return Math.min(ranked.length, 50);
}

export async function getAwardedBadges(userId: string): Promise<AwardedBadge[]> {
  await ensureBadgeCatalog();
  await syncUserBadges(userId);
  await syncTopMakerBadges();
  return prisma.userBadge.findMany({
    where: { userId },
    include: { badge: { select: { key: true, name: true, icon: true } } },
    orderBy: { awardedAt: "desc" },
  }).then((rows) => rows.map(({ badge, awardedAt }) => ({
    key: badge.key as BadgeKey,
    name: badge.name,
    icon: badge.icon,
    awardedAt,
  })));
}

export async function getTopMakers() {
  await ensureBadgeCatalog();
  const { ranked } = await syncTopMakerBadges();
  const topRows = ranked.slice(0, 50);
  if (!topRows.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: topRows.map(([userId]) => userId) } },
    select: {
      id: true,
      name: true,
      image: true,
      handle: true,
      headline: true,
      userBadges: { include: { badge: { select: { key: true, name: true, icon: true } } }, orderBy: { awardedAt: "desc" } },
    },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  return topRows.flatMap(([userId, score], index) => {
    const user = byId.get(userId);
    if (!user) return [];
    return [{
      rank: index + 1,
      activityScore: score,
      maker: {
        id: user.id,
        name: user.name,
        image: user.image,
        handle: user.handle,
        headline: user.headline,
        badges: user.userBadges.map(({ badge, awardedAt }) => ({
          key: badge.key as BadgeKey,
          name: badge.name,
          icon: badge.icon,
          awardedAt,
        })),
      },
    }];
  });
}
