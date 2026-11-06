import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  userId: z.string().min(1).max(128),
  role: z.enum(["CONTRIBUTOR", "OBSERVER"]),
});

async function getAccess(request: Request, teamId: string, userId: string) {
  return resolveCodingWorkspaceForRequest(
    userId,
    new Request(request.url, { headers: { "x-lynora-coding-team": teamId } }),
  );
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await props.params;
  try {
    const access = await getAccess(request, id, session.user.id);
    if (!access) return NextResponse.json({ error: "TEAM_ACCESS_REQUIRED" }, { status: 403 });
    const collaborators = await prisma.projectCollaborator.findMany({
      where: { projectId: id, status: "APPROVED" },
      orderBy: { createdAt: "asc" },
      select: {
        codingRole: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });
    const team = await prisma.project.findUniqueOrThrow({
      where: { id },
      select: { creator: { select: { id: true, name: true, image: true } } },
    });
    return NextResponse.json({
      members: [
        { ...team.creator, role: "LEADER" as const },
        ...collaborators
          .filter((member) => member.user.id !== team.creator.id)
          .map((member) => ({ ...member.user, role: member.codingRole })),
      ],
    });
  } catch (error) {
    console.error("Unable to load coding workspace members:", error);
    return NextResponse.json({ error: "Unable to load team members." }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid team coding role." }, { status: 400 });
  const { id } = await props.params;

  try {
    const access = await getAccess(request, id, session.user.id);
    if (access?.role !== "LEADER") {
      return NextResponse.json({ error: "Only team leaders can manage coding permissions." }, { status: 403 });
    }
    const updated = await prisma.projectCollaborator.updateMany({
      where: { projectId: id, userId: parsed.data.userId, status: "APPROVED" },
      data: { codingRole: parsed.data.role },
    });
    if (updated.count !== 1) return NextResponse.json({ error: "TEAM_MEMBER_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ userId: parsed.data.userId, role: parsed.data.role });
  } catch (error) {
    console.error("Unable to update a coding workspace role:", error);
    return NextResponse.json({ error: "Unable to update team permissions." }, { status: 500 });
  }
}
