import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AdminSection = "overview" | "users" | "projects" | "teams" | "posts" | "feedback" | "marketplace" | "communications" | "revenue" | "analytics";

const adminSections: AdminSection[] = ["overview", "users", "projects", "teams", "posts", "feedback", "marketplace", "communications", "revenue", "analytics"];

function parseSeenAt(value: string | null, now: Date) {
  const seenAt: Partial<Record<AdminSection, Date>> = {};
  if (!value) return seenAt;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    for (const section of adminSections) {
      const timestamp = parsed[section];
      if (typeof timestamp !== "string") continue;
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime()) && date <= now) seenAt[section] = date;
    }
  } catch {
    return seenAt;
  }
  return seenAt;
}

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const now = new Date();
  const recentSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const seenAt = parseSeenAt(new URL(request.url).searchParams.get("seenAt"), now);
  const since = (section: AdminSection) => seenAt[section] ?? recentSince;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyBuckets = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { start, end: new Date(now.getFullYear(), now.getMonth() - 4 + index, 1) };
  });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weeklyBuckets = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(today);
    start.setDate(today.getDate() - 6 + index);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start, end };
  });
  const [
    users,
    activeUsers,
    projects,
    posts,
    pendingMarketplaceItems,
    projectStatuses,
    postTypes,
    reportedPosts,
    activeBoosts,
    marketplaceSales,
    recentUsers,
    revenueOrders,
    locationGroups,
    recentProjects,
    recentTeams,
    reportedPostItems,
    monthlyUserCounts,
    teamCount,
    usersSinceSeen,
    projectsSinceSeen,
    teamsSinceSeen,
    postsSinceSeen,
    reportsSinceSeen,
    marketplaceSinceSeen,
    emailsSinceSeen,
    revenueSinceSeen,
    analyticsSinceSeen,
    overviewUsers,
    overviewProjects,
    overviewTeams,
    overviewPosts,
    overviewReports,
    overviewMarketplace,
    overviewSales,
    overviewAdminActions,
    monthlyTeamCounts,
    weeklyPostCounts,
    interactivePostCandidates,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isOnline: true } }),
    prisma.project.count(),
    prisma.post.count(),
    prisma.marketplaceItem.count({ where: { moderationStatus: "PENDING" } }),
    prisma.project.groupBy({ by: ["status"], where: { teamName: null }, _count: { _all: true } }),
    prisma.post.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.post.count({ where: { reports: { some: {} } } }),
    prisma.boost.count({ where: { expiresAt: { gt: now } } }),
    prisma.marketplaceOrder.count({ where: { status: "PAID" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, handle: true, image: true, city: true, location: true, createdAt: true, isOnline: true } }),
    prisma.marketplaceOrder.findMany({ where: { status: "PAID", createdAt: { gte: monthStart } }, select: { platformFeeCents: true } }),
    prisma.$queryRaw<Array<{ location: string; users: number }>>(Prisma.sql`
      SELECT COALESCE(
        CASE WHEN LOWER(BTRIM("location")) IN ('', 'non renseignée', 'localisation non renseignée', 'not specified', 'unspecified') THEN NULL ELSE BTRIM("location") END,
        NULLIF(BTRIM("city"), ''),
        'Localisation non renseignée'
      ) AS location,
        COUNT(*)::int AS users
      FROM "User"
      GROUP BY 1
      ORDER BY users DESC
      LIMIT 100
    `),
    prisma.project.findMany({
      where: { teamName: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, tagline: true, teamName: true, status: true, moderationStatus: true, updatedAt: true, creator: { select: { name: true, handle: true } }, _count: { select: { collaborators: true, posts: true, tasks: true } } },
    }),
    prisma.project.findMany({
      where: { teamName: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, teamName: true, status: true, moderationStatus: true, updatedAt: true, _count: { select: { collaborators: true, teamPosts: true } } },
    }),
    prisma.post.findMany({
      where: { reports: { some: {} } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, content: true, type: true, createdAt: true, author: { select: { name: true, handle: true } }, _count: { select: { reports: true } } },
    }),
    Promise.all(monthlyBuckets.map(({ start, end }) => prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }))),
    prisma.project.count({ where: { teamName: { not: null } } }),
    seenAt.users
      ? prisma.user.count({ where: { updatedAt: { gt: since("users") } } })
      : prisma.user.count({ where: { createdAt: { gt: recentSince } } }),
    seenAt.projects
      ? prisma.project.count({ where: { teamName: null, updatedAt: { gt: since("projects") } } })
      : prisma.project.count({ where: { teamName: null, moderationStatus: "PENDING" } }),
    seenAt.teams
      ? prisma.project.count({ where: { teamName: { not: null }, updatedAt: { gt: since("teams") } } })
      : prisma.project.count({ where: { teamName: { not: null }, moderationStatus: "PENDING" } }),
    prisma.post.count({ where: { updatedAt: { gt: since("posts") } } }),
    seenAt.posts
      ? prisma.postReport.count({ where: { createdAt: { gt: since("posts") } } })
      : prisma.postReport.count(),
    seenAt.marketplace
      ? prisma.marketplaceItem.count({ where: { updatedAt: { gt: since("marketplace") } } })
      : prisma.marketplaceItem.count({ where: { moderationStatus: "PENDING" } }),
    prisma.auditLog.count({ where: { action: "ADMIN_EMAIL_SENT", createdAt: { gt: since("communications") } } }),
    prisma.marketplaceOrder.count({ where: { status: "PAID", paidAt: { gt: since("revenue") } } }),
    prisma.user.count({ where: { createdAt: { gt: since("analytics") } } }),
    prisma.user.count({ where: { createdAt: { gt: since("overview") } } }),
    prisma.project.count({ where: { teamName: null, updatedAt: { gt: since("overview") } } }),
    prisma.project.count({ where: { teamName: { not: null }, updatedAt: { gt: since("overview") } } }),
    prisma.post.count({ where: { updatedAt: { gt: since("overview") } } }),
    prisma.postReport.count({ where: { createdAt: { gt: since("overview") } } }),
    prisma.marketplaceItem.count({ where: { updatedAt: { gt: since("overview") } } }),
    prisma.marketplaceOrder.count({ where: { status: "PAID", paidAt: { gt: since("overview") } } }),
    prisma.auditLog.count({ where: { action: { not: "ADMIN_VIEW" }, createdAt: { gt: since("overview") } } }),
    Promise.all(monthlyBuckets.map(({ start, end }) => prisma.project.count({ where: { teamName: { not: null }, createdAt: { gte: start, lt: end } } }))),
    Promise.all(weeklyBuckets.map(({ start, end }) => prisma.post.count({ where: { moderationStatus: "APPROVED", createdAt: { gte: start, lt: end } } }))),
    prisma.post.findMany({
      where: { moderationStatus: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, content: true, type: true, createdAt: true, author: { select: { name: true, handle: true } }, _count: { select: { likes: true, comments: true } } },
    }),
  ]);

  const [reviewsSinceSeen, pollVotesSinceSeen, projectFeedbackSinceSeen] = await Promise.all([
    prisma.review.count({ where: { createdAt: { gt: since("feedback") } } }),
    prisma.pollVote.count({ where: { createdAt: { gt: since("feedback") } } }),
    prisma.projectFeedback.count({ where: { createdAt: { gt: since("feedback") } } }),
  ]);
  const marketplaceRevenue = revenueOrders.reduce((sum, order) => sum + order.platformFeeCents, 0);
  const projectStatusCounts = Object.fromEntries(projectStatuses.map((item) => [item.status, item._count._all]));
  const postTypeCounts = Object.fromEntries(postTypes.map((item) => [item.type, item._count._all]));
  const topInteractivePosts = interactivePostCandidates
    .map((post) => ({ ...post, interactions: post._count.likes + post._count.comments }))
    .sort((first, second) => second.interactions - first.interactions)
    .slice(0, 8);

  return NextResponse.json({
    admin: { id: access.admin.id, role: access.admin.role },
    stats: { users, activeUsers, projects, posts, reportedPosts, pendingMarketplaceItems, activeBoosts, marketplaceSales, marketplaceRevenue },
    navCounts: {
      overview: overviewUsers + overviewProjects + overviewTeams + overviewPosts + overviewReports + overviewMarketplace + overviewSales + overviewAdminActions,
      users: usersSinceSeen,
      projects: projectsSinceSeen,
      teams: teamsSinceSeen,
      posts: postsSinceSeen + reportsSinceSeen,
      feedback: reviewsSinceSeen + pollVotesSinceSeen + projectFeedbackSinceSeen,
      marketplace: marketplaceSinceSeen,
      communications: emailsSinceSeen,
      revenue: revenueSinceSeen,
      analytics: analyticsSinceSeen,
    },
    projectStatusCounts,
    postTypeCounts,
    recentUsers,
    geoDistribution: locationGroups.map((item) => ({ location: item.location, users: Number(item.users) })),
    recentProjects,
    recentTeams,
    reportedPostItems,
    monthlyUserGrowth: monthlyBuckets.map(({ start }, index) => ({
      label: start.toLocaleDateString("fr-FR", { month: "short" }),
      users: monthlyUserCounts[index],
    })),
    monthlyTeamGrowth: monthlyBuckets.map(({ start }, index) => ({
      label: start.toLocaleDateString("fr-FR", { month: "short" }),
      teams: monthlyTeamCounts[index],
    })),
    weeklyPostActivity: weeklyBuckets.map(({ start }, index) => ({
      label: start.toLocaleDateString("fr-FR", { weekday: "short" }),
      posts: weeklyPostCounts[index],
    })),
    topInteractivePosts,
    teamCount,
  });
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "ADMIN_VIEW";
  const targetId = typeof body.targetId === "string" ? body.targetId : null;
  const log = await prisma.auditLog.create({ data: { adminId: access.admin.id, action, targetId } });
  return NextResponse.json({ log }, { status: 201 });
}
