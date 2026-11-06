import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const teams = await prisma.project.findMany({
      where: {
        teamName: { not: null },
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "APPROVED" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        teamName: true,
        creatorId: true,
        collaborators: {
          where: { userId: session.user.id, status: "APPROVED" },
          select: { codingRole: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      teams: teams.map((team) => ({
        id: team.id,
        name: team.teamName?.trim() || team.title,
        role: team.creatorId === session.user.id ? "LEADER" : team.collaborators[0]?.codingRole ?? "OBSERVER",
      })),
    });
  } catch (error) {
    console.error("Unable to list coding teams:", error);
    return NextResponse.json({ error: "Unable to load your team workspaces." }, { status: 500 });
  }
}
