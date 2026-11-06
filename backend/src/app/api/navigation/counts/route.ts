import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getTopMakerCount } from "@/lib/gamification";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const [unreadRows, myProjects, myTeams, discoverProjects, marketplaceItems, topMakers, incomingAssociationRequests, associationSuggestions] = await Promise.all([
    prisma.$queryRaw<Array<{ unreadCount: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS "unreadCount"
      FROM "Message" AS message
      INNER JOIN "ConversationMember" AS member ON member."conversationId" = message."conversationId"
      WHERE member."userId" = ${userId}
        AND message."senderId" <> ${userId}
        AND (member."lastReadAt" IS NULL OR message."createdAt" > member."lastReadAt")
    `),
    prisma.project.count({ where: { creatorId: userId, teamName: null } }),
    prisma.project.count({ where: { teamName: { not: null }, OR: [{ creatorId: userId }, { collaborators: { some: { userId } } }] } }),
    prisma.project.count({ where: { teamName: null } }),
    prisma.marketplaceItem.count({ where: { isActive: true } }),
    getTopMakerCount(),
    prisma.association.count({ where: { addresseeId: userId, status: "PENDING" } }),
    prisma.user.count({
      where: {
        id: { not: userId },
        sentAssociations: { none: {} },
        receivedAssociations: { none: {} },
      },
    }),
  ]);

  return NextResponse.json({
    counts: {
      unreadMessages: Number(unreadRows[0]?.unreadCount ?? 0n),
      myProjects,
      myTeams,
      discoverProjects,
      marketplaceItems,
      topMakers,
      makers: incomingAssociationRequests + associationSuggestions,
    },
  });
}