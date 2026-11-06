import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  projectId: z.string().cuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
});

async function getTeamAdmin(teamId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };

  const team = await prisma.project.findUnique({
    where: { id: teamId },
    select: { creatorId: true, teamName: true },
  });
  if (!team?.teamName?.trim()) return { response: NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 }) };
  if (team.creatorId !== userId) return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { userId };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await getTeamAdmin(id);
  if ("response" in access) return access.response;

  const projects = await prisma.project.findMany({
    where: { parentTeamId: id },
    orderBy: [{ moderationStatus: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      moderationStatus: true,
      createdAt: true,
      creator: { select: { name: true, handle: true } },
    },
  });
  return NextResponse.json({ projects });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await getTeamAdmin(id);
  if ("response" in access) return access.response;

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_PROJECT_REVIEW" }, { status: 422 });

  const updated = await prisma.project.updateMany({
    where: { id: parsed.data.projectId, parentTeamId: id, moderationStatus: "PENDING" },
    data: {
      moderationStatus: parsed.data.status,
      reviewedBy: access.userId,
      reviewDate: new Date(),
    },
  });
  if (!updated.count) {
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, parentTeamId: id },
      select: { id: true },
    });
    return NextResponse.json(
      { error: project ? "PROJECT_ALREADY_REVIEWED" : "PROJECT_NOT_FOUND" },
      { status: project ? 409 : 404 },
    );
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: parsed.data.projectId },
    select: { id: true, moderationStatus: true },
  });
  return NextResponse.json({ project });
}
