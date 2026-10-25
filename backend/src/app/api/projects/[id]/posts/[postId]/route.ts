import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; postId: string }> };
const moderationSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

async function ownedTeam(id: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { creatorId: true } });
  return project?.creatorId === userId;
}

async function teamPost(postId: string, teamId: string) {
  return prisma.post.findFirst({
    where: { id: postId, OR: [{ projectId: teamId }, { teamId }] },
    select: { id: true },
  });
}

export async function PATCH(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await ownedTeam(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  if (!(await teamPost(params.postId, params.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const post = await prisma.post.update({
    where: { id: params.postId },
    data: { moderationStatus: parsed.data.status, reviewedBy: session.user.id, reviewDate: new Date() },
  });
  return NextResponse.json({ post });
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