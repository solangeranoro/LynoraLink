import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ people: [], projects: [], teams: [] });

  const [people, projects, teams] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        accountStatus: "ACTIVE",
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { handle: { contains: query, mode: "insensitive" } },
          { headline: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, image: true, handle: true, headline: true },
      orderBy: [{ openToCoBuild: "desc" }, { name: "asc" }],
      take: 5,
    }),
    prisma.project.findMany({
      where: {
        teamName: null,
        parentTeamId: null,
        isPrivate: false,
        moderationStatus: "APPROVED",
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { tagline: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        tagline: true,
        logoUrl: true,
        creator: { select: { name: true, handle: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.project.findMany({
      where: {
        teamName: { not: null },
        parentTeamId: null,
        isPrivate: false,
        moderationStatus: "APPROVED",
        OR: [
          { teamName: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { tagline: { contains: query, mode: "insensitive" } },
          { teamDescription: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        teamName: true,
        tagline: true,
        logoUrl: true,
        creator: { select: { name: true, handle: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);

  return NextResponse.json({ people, projects, teams });
}
