import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; postId: string }> };
const moderationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  removeAuthor: z.boolean().optional().default(false),
}).refine((data) => !data.removeAuthor || data.status === "REJECTED");

async function ownedTeam(id: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { creatorId: true } });
  return project?.creatorId === userId;
}

async function teamPost(postId: string, teamId: string) {
  const childProjects = await prisma.project.findMany({
    where: { parentTeamId: teamId },
    select: { id: true },
  });
  return prisma.post.findFirst({
    where: { id: postId, OR: [{ projectId: { in: [teamId, ...childProjects.map(({ id }) => id)] } }, { teamId }] },
    select: { id: true, authorId: true },
  });
}

export async function PATCH(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await ownedTeam(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  const post = await teamPost(params.postId, params.id);
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (parsed.data.removeAuthor) {
    const team = await prisma.project.findUnique({
      where: { id: params.id },
      select: { creatorId: true, teamName: true },
    });
    if (!team?.teamName || post.authorId === team.creatorId) {
      return NextResponse.json({ error: "AUTHOR_NOT_REMOVABLE" }, { status: 409 });
    }
    const membership = await prisma.projectCollaborator.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: post.authorId } },
      select: { id: true, status: true, role: true },
    });
    if (!membership || membership.status !== "APPROVED" || membership.role === "FOUNDER") {
      return NextResponse.json({ error: "AUTHOR_NOT_REMOVABLE" }, { status: 409 });
    }
    const childProjects = await prisma.project.findMany({
      where: { parentTeamId: params.id, creatorId: { not: post.authorId } },
      select: { id: true },
    });
    const teamProjectIds = [params.id, ...childProjects.map(({ id }) => id)];
    const [updatedPost] = await prisma.$transaction([
      prisma.post.update({
        where: { id: params.postId },
        data: { moderationStatus: "REJECTED", reviewedBy: session.user.id, reviewDate: new Date() },
      }),
      prisma.projectCollaborator.deleteMany({
        where: {
          userId: post.authorId,
          projectId: { in: teamProjectIds },
          role: { not: "FOUNDER" },
        },
      }),
    ]);
    return NextResponse.json({ post: updatedPost, authorRemoved: true });
  }

  const updatedPost = await prisma.post.update({
    where: { id: params.postId },
    data: { moderationStatus: parsed.data.status, reviewedBy: session.user.id, reviewDate: new Date() },
  });
  return NextResponse.json({ post: updatedPost, authorRemoved: false });
}

export async function DELETE(_request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await ownedTeam(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await teamPost(params.postId, params.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.post.delete({ where: { id: params.postId } });
  return NextResponse.json({ ok: true });
}