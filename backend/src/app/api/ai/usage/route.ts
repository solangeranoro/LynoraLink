import { auth } from "@/lib/auth";
import { getLynoAIQuota, isLynoAIPlatform, LYNOAI_PLATFORMS } from "@/lib/lynoai-quota";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DailyUsageRow = { day: string; platform: string; requests: number };
type MonthlyUsageRow = { platform: string; requests: number };
type FirstUsageRow = { firstUsage: Date | null };
type ActionUsageRow = { actionType: string; platform: string; requests: number };
type RecentActivityRow = { id: string; actionType: string; platform: string; countsTowardQuota: boolean; createdAt: Date };

function utcDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcTimestamp(date: Date) {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const platform = new URL(request.url).searchParams.get("platform");
  if (!isLynoAIPlatform(platform)) {
    return NextResponse.json({ error: "INVALID_PLATFORM" }, { status: 422 });
  }

  try {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rangeStart = new Date(today);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 29);

    const [quotas, firstUsageRows, dailyRows, monthlyRows, actionRows, recentRows] = await Promise.all([
      Promise.all(LYNOAI_PLATFORMS.map(async (item) => [
        item,
        await getLynoAIQuota(userId, item),
      ] as const)),
      prisma.$queryRaw<FirstUsageRow[]>`
        SELECT MIN("createdAt") AS "firstUsage"
        FROM "LynoAIUsageEvent"
        WHERE "userId" = ${userId}
          AND "countsTowardQuota" = TRUE
      `,
      prisma.$queryRaw<DailyUsageRow[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
          platform,
          COUNT(*)::int AS requests
        FROM "LynoAIUsageEvent"
        WHERE "userId" = ${userId}
          AND "countsTowardQuota" = TRUE
          AND "createdAt" >= ${utcTimestamp(rangeStart)}::timestamp
          AND platform IN ('lynoralink', 'lynoracoding')
        GROUP BY 1, platform
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<MonthlyUsageRow[]>`
        SELECT platform, COUNT(*)::int AS requests
        FROM "LynoAIUsageEvent"
        WHERE "userId" = ${userId}
          AND "countsTowardQuota" = TRUE
          AND "createdAt" >= ${utcTimestamp(monthStart)}::timestamp
          AND "createdAt" < ${utcTimestamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)))}::timestamp
          AND platform IN ('lynoralink', 'lynoracoding')
        GROUP BY platform
      `,
      prisma.$queryRaw<ActionUsageRow[]>`
        SELECT "actionType", platform, COUNT(*)::int AS requests
        FROM "LynoAIUsageEvent"
        WHERE "userId" = ${userId}
          AND "createdAt" >= ${utcTimestamp(monthStart)}::timestamp
          AND "createdAt" < ${utcTimestamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)))}::timestamp
        GROUP BY "actionType", platform
        ORDER BY requests DESC, "actionType" ASC
      `,
      prisma.$queryRaw<RecentActivityRow[]>`
        SELECT id, "actionType", platform, "countsTowardQuota", "createdAt"
        FROM "LynoAIUsageEvent"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
        LIMIT 20
      `,
    ]);

    const firstUsage = firstUsageRows[0]?.firstUsage ?? null;
    const firstTrackedDay = firstUsage
      ? utcDateString(firstUsage) > utcDateString(rangeStart) ? utcDateString(firstUsage) : utcDateString(rangeStart)
      : null;
    const dailyByDate = new Map<string, { lynoralink: number; lynoracoding: number }>();
    for (const row of dailyRows) {
      if (!firstTrackedDay || row.day < firstTrackedDay) continue;
      const point = dailyByDate.get(row.day) ?? { lynoralink: 0, lynoracoding: 0 };
      if (row.platform === "lynoralink" || row.platform === "lynoracoding") {
        point[row.platform] = row.requests;
      }
      dailyByDate.set(row.day, point);
    }

    const daily = firstTrackedDay
      ? Array.from({ length: Math.max(1, Math.floor((today.getTime() - new Date(`${firstTrackedDay}T00:00:00.000Z`).getTime()) / 86_400_000) + 1) }, (_, index) => {
        const day = new Date(`${firstTrackedDay}T00:00:00.000Z`);
        day.setUTCDate(day.getUTCDate() + index);
        const date = utcDateString(day);
        return { date, ...(dailyByDate.get(date) ?? { lynoralink: 0, lynoracoding: 0 }) };
      })
      : [];

    const quotaMap = Object.fromEntries(quotas);
    const monthlyUsage = { lynoralink: 0, lynoracoding: 0 };
    for (const row of monthlyRows) {
      if (row.platform === "lynoralink" || row.platform === "lynoracoding") {
        monthlyUsage[row.platform] = row.requests;
      }
    }
    const actionUsage = actionRows.map((row) => ({
      actionType: row.actionType,
      platform: row.platform,
      count: row.requests,
    }));
    const recentActivity = recentRows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      platform: row.platform,
      countsTowardQuota: row.countsTowardQuota,
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      platform,
      quota: quotaMap[platform],
      quotas: quotaMap,
      monthlyUsage,
      actionUsage,
      recentActivity,
      daily,
      trackingSince: firstUsage?.toISOString() ?? null,
      generatedAt: now.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load LynoAI usage analytics:", error);
    return NextResponse.json({ error: "LYNOAI_ANALYTICS_UNAVAILABLE" }, { status: 503 });
  }
}
