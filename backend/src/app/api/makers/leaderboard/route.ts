import { NextResponse } from "next/server";
import { getTopMakers } from "@/lib/gamification";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [makers, teams, applications] = await Promise.all([
    getTopMakers(),
    prisma.$queryRaw<Array<{
      id: string;
      name: string;
      tagline: string;
      logoUrl: string | null;
      reviewCount: number;
      averageRating: number;
      memberCount: number;
    }>>`
      SELECT
        team."id",
        COALESCE(NULLIF(BTRIM(team."teamName"), ''), team."title") AS "name",
        team."tagline",
        team."logoUrl",
        COUNT(review."id")::int AS "reviewCount",
        COALESCE(AVG(review."rating"), 0)::float8 AS "averageRating",
        (
          SELECT COUNT(*)::int
          FROM "ProjectCollaborator" AS member
          WHERE member."projectId" = team."id" AND member."status" = 'APPROVED'
        ) AS "memberCount"
      FROM "Project" AS team
      LEFT JOIN "Project" AS relatedProject
        ON (relatedProject."id" = team."id" OR relatedProject."parentTeamId" = team."id")
        AND relatedProject."isPrivate" = false
        AND (relatedProject."parentTeamId" IS NULL OR relatedProject."moderationStatus" = 'APPROVED')
      LEFT JOIN "Review" AS review ON review."targetId" = relatedProject."id"
      WHERE team."teamName" IS NOT NULL
        AND BTRIM(team."teamName") <> ''
        AND team."isPrivate" = false
      GROUP BY team."id", team."teamName", team."title", team."tagline", team."logoUrl"
      HAVING COUNT(review."id") > 0
      ORDER BY COUNT(review."id") DESC, AVG(review."rating") DESC, "name" ASC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{
      id: string;
      name: string;
      platform: string;
      logoUrl: string | null;
      ownerName: string;
      reviewCount: number;
      averageRating: number;
    }>>`
      SELECT
        application."id",
        application."name",
        application."platform"::text AS "platform",
        application."logoUrl",
        application."ownerName",
        COUNT(activity."id")::int AS "reviewCount",
        COALESCE(AVG(activity."rating"), 0)::float8 AS "averageRating"
      FROM "TesterApplication" AS application
      INNER JOIN "TesterApplicationActivity" AS activity
        ON activity."applicationId" = application."id"
        AND activity."type" = 'REVIEW'
        AND activity."rating" IS NOT NULL
      WHERE application."status" = 'APPROVED'
      GROUP BY application."id"
      ORDER BY COUNT(activity."id") DESC, AVG(activity."rating") DESC, application."name" ASC
      LIMIT 10
    `,
  ]);
  return NextResponse.json({ makers, teams, applications });
}
