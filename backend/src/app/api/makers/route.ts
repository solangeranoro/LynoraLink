import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim() ?? "";
  const includeOffline = searchParams.get("all") === "1" || Boolean(query);
  const requestedTake = Number(searchParams.get("take"));
  const requestedSkip = Number(searchParams.get("skip"));
  const take = Number.isInteger(requestedTake) && requestedTake > 0
    ? Math.min(requestedTake, 100)
    : query ? 20 : includeOffline ? 50 : 12;
  const skip = Number.isInteger(requestedSkip) && requestedSkip > 0 ? requestedSkip : 0;
  if (query) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (query.length < 2) return NextResponse.json({ makers: [] });
  }

  const makers = await prisma.user.findMany({
    where: {
      ...(includeOffline ? {} : { isOnline: true }),
      ...(query ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { handle: { contains: query, mode: "insensitive" } },
          { headline: { contains: query, mode: "insensitive" } },
        ],
      } : {}),
    },
    select: {
      id: true,
      name: true,
      image: true,
      handle: true,
      headline: true,
      skills: true,
      isOnline: true,
      openToCoBuild: true,
      lastSeenAt: true,
    },
    orderBy: [{ openToCoBuild: "desc" }, { isOnline: "desc" }, { lastSeenAt: "desc" }],
    take: take + 1,
    skip,
  });
  return NextResponse.json({ makers: makers.slice(0, take), hasMore: makers.length > take });
}