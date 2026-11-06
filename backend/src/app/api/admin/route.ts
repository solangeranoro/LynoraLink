import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";
import { isPaddleCopilotEntitled } from "@/lib/paddle";

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
  const dailyGrowthStart = new Date(now);
  dailyGrowthStart.setUTCHours(0, 0, 0, 0);
  dailyGrowthStart.setUTCDate(dailyGrowthStart.getUTCDate() - 29);
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
    recentUsers,
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
    overviewAdminActions,
    monthlyTeamCounts,
    weeklyPostCounts,
    interactivePostCandidates,
    dailyUserGrowthCounts,
    openModerationCases,
    pendingTesterApplications,
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
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, handle: true, image: true, city: true, location: true, createdAt: true, isOnline: true } }),
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
      : prisma.project.count({ where: { teamName: null, createdAt: { gt: recentSince } } }),
    seenAt.teams
      ? prisma.project.count({ where: { teamName: { not: null }, updatedAt: { gt: since("teams") } } })
      : prisma.project.count({ where: { teamName: { not: null }, createdAt: { gt: recentSince } } }),
    prisma.post.count({ where: { updatedAt: { gt: since("posts") } } }),
    seenAt.posts
      ? prisma.postReport.count({ where: { createdAt: { gt: since("posts") } } })
      : prisma.postReport.count(),
    seenAt.marketplace
      ? prisma.marketplaceItem.count({ where: { updatedAt: { gt: since("marketplace") } } })
      : prisma.marketplaceItem.count({ where: { moderationStatus: "PENDING" } }),
    prisma.auditLog.count({ where: { action: "ADMIN_EMAIL_SENT", createdAt: { gt: since("communications") } } }),
    prisma.paymentCheckout.count({
      where: {
        kind: "copilot_subscription",
        status: "COMPLETED",
        paidAt: { gt: since("revenue") },
      },
    }),
    prisma.user.count({ where: { createdAt: { gt: since("analytics") } } }),
    prisma.user.count({ where: { createdAt: { gt: since("overview") } } }),
    prisma.project.count({ where: { teamName: null, updatedAt: { gt: since("overview") } } }),
    prisma.project.count({ where: { teamName: { not: null }, updatedAt: { gt: since("overview") } } }),
    prisma.post.count({ where: { updatedAt: { gt: since("overview") } } }),
    prisma.postReport.count({ where: { createdAt: { gt: since("overview") } } }),
    prisma.marketplaceItem.count({ where: { updatedAt: { gt: since("overview") } } }),
    prisma.auditLog.count({ where: { action: { not: "ADMIN_VIEW" }, createdAt: { gt: since("overview") } } }),
    Promise.all(monthlyBuckets.map(({ start, end }) => prisma.project.count({ where: { teamName: { not: null }, createdAt: { gte: start, lt: end } } }))),
    Promise.all(weeklyBuckets.map(({ start, end }) => prisma.post.count({ where: { moderationStatus: "APPROVED", createdAt: { gte: start, lt: end } } }))),
    prisma.post.findMany({
      where: { moderationStatus: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, content: true, type: true, createdAt: true, author: { select: { name: true, handle: true } }, _count: { select: { likes: true, comments: true } } },
    }),
    prisma.$queryRaw<Array<{ day: string; users: number }>>(Prisma.sql`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS users
      FROM "User"
      WHERE "createdAt" >= ${dailyGrowthStart}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day
    `),
    prisma.postModerationCase.count({ where: { status: "OPEN" } }),
    prisma.testerApplication.count({ where: { status: "PENDING" } }),
  ]);

  const [reviewsSinceSeen, pollVotesSinceSeen, projectFeedbackSinceSeen] = await Promise.all([
    prisma.review.count({ where: { createdAt: { gt: since("feedback") } } }),
    prisma.pollVote.count({ where: { createdAt: { gt: since("feedback") } } }),
    prisma.projectFeedback.count({ where: { createdAt: { gt: since("feedback") } } }),
  ]);
  const [premiumUsers, sellerVerifications, pendingSellerVerifications, paymentRows] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { lynaiPremium: true },
          {
            paddleCopilotSubscription: {
              is: { status: { in: ["active", "trialing", "canceled"] } },
            },
          },
        ],
      },
      select: {
        lynaiPremium: true,
        paddleCopilotSubscription: { select: { status: true, currentPeriodEnd: true } },
      },
    }),
    prisma.marketplaceVerification.findMany({
      where: { emailVerifiedAt: { not: null } },
      select: {
        email: true,
        status: true,
        currentPeriodEnd: true,
        user: { select: { email: true, emailVerified: true } },
      },
    }),
    prisma.marketplaceVerification.count({ where: { emailVerifiedAt: null } }),
    prisma.$queryRaw<Array<{ kind: string; currency: string; month: string; transactions: number; amountCents: string }>>(Prisma.sql`
      SELECT
        "kind",
        "currency",
        TO_CHAR(DATE_TRUNC('month', "paidAt"), 'YYYY-MM') AS month,
        COUNT(*)::int AS transactions,
        COALESCE(SUM("amountCents"), 0)::text AS "amountCents"
      FROM "PaymentCheckout"
      WHERE "status" = 'COMPLETED'
        AND "kind" = 'copilot_subscription'
        AND "paidAt" >= ${monthlyBuckets[0].start}
        AND "paidAt" < ${monthlyBuckets[monthlyBuckets.length - 1].end}
      GROUP BY "kind", "currency", DATE_TRUNC('month', "paidAt")
      ORDER BY month, "kind", "currency"
    `),
  ]);
  const paymentHistory = new Map<string, Map<string, { amountCents: number; transactions: number }>>();
  for (const row of paymentRows) {
    const monthPayments = paymentHistory.get(row.month) ?? new Map();
    monthPayments.set(row.currency, {
      amountCents: Number(row.amountCents),
      transactions: row.transactions,
    });
    paymentHistory.set(row.month, monthPayments);
  }
  const revenueHistory = monthlyBuckets.map(({ start }) => {
    const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const payments = paymentHistory.get(month);
    const amounts = (values: Map<string, { amountCents: number; transactions: number }> | undefined) =>
      Array.from(values ?? [], ([currency, value]) => ({ currency, ...value }));
    return {
      label: start.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
      lynoaiPremium: amounts(payments),
    };
  });
  const currentMonthPayments = revenueHistory[revenueHistory.length - 1];
  const paymentsThisMonth = currentMonthPayments.lynoaiPremium
    .reduce((total, payment) => total + payment.transactions, 0);
  const activeLynoAIPremium = premiumUsers.filter((user) =>
    user.lynaiPremium || isPaddleCopilotEntitled(
      user.paddleCopilotSubscription?.status ?? "",
      user.paddleCopilotSubscription?.currentPeriodEnd ?? null,
      now,
    ),
  ).length;
  const verifiedSellerAccounts = sellerVerifications.filter((verification) =>
    verification.user.emailVerified &&
    verification.email.toLowerCase() === verification.user.email.toLowerCase() &&
    hasActiveMarketplaceVerification(verification, now),
  ).length;
  const projectStatusCounts = Object.fromEntries(projectStatuses.map((item) => [item.status, item._count._all]));
  const postTypeCounts = Object.fromEntries(postTypes.map((item) => [item.type, item._count._all]));
  const topInteractivePosts = interactivePostCandidates
    .map((post) => ({ ...post, interactions: post._count.likes + post._count.comments }))
    .sort((first, second) => second.interactions - first.interactions)
    .slice(0, 8);
  const dailyUserCounts = new Map(dailyUserGrowthCounts.map(({ day, users }) => [day, users]));

  return NextResponse.json({
    admin: { id: access.admin.id, role: access.admin.role },
    stats: { users, activeUsers, projects, posts, reportedPosts, pendingMarketplaceItems, activeBoosts },
    monetization: {
      activeLynoAIPremium,
      verifiedSellerAccounts,
      pendingSellerVerifications,
      paymentsThisMonth,
      revenueHistory,
    },
    navCounts: {
      overview: overviewUsers + overviewProjects + overviewTeams + overviewPosts + overviewReports + overviewMarketplace + overviewAdminActions,
      users: usersSinceSeen,
      projects: projectsSinceSeen,
      teams: teamsSinceSeen,
      posts: postsSinceSeen + reportsSinceSeen,
      feedback: reviewsSinceSeen + pollVotesSinceSeen + projectFeedbackSinceSeen,
      marketplace: marketplaceSinceSeen,
      communications: emailsSinceSeen,
      moderation: openModerationCases,
      testerApplications: pendingTesterApplications,
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
    dailyUserGrowth: Array.from({ length: 30 }, (_, index) => {
      const start = new Date(dailyGrowthStart);
      start.setUTCDate(start.getUTCDate() + index);
      return {
        label: start.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }),
        users: dailyUserCounts.get(start.toISOString().slice(0, 10)) ?? 0,
      };
    }),
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
