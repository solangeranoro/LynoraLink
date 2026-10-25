import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { recordInteraction } from "@/lib/gamification";

type RouteContext = { params: Promise<{ id: string }> };
const collaboratorStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
const invitationSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"]),
});

export async function GET(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { creatorId: true } });
  if (!project || project.creatorId !== session.user.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const requestedStatus = new URL(request.url).searchParams.get("status");
  if (requestedStatus && !collaboratorStatuses.includes(requestedStatus as typeof collaboratorStatuses[number])) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }

  const collaborators = await prisma.projectCollaborator.findMany({
    where: {
      projectId: params.id,
      ...(requestedStatus ? { status: requestedStatus as typeof collaboratorStatuses[number] } : {}),
    },
    include: {
      user: { select: { id: true, name: true, image: true, handle: true, headline: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ collaborators });
}

export async function POST(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  const inviterId = session?.user?.id;
  if (!inviterId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { creatorId: true } });
  if (!project || project.creatorId !== inviterId) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === inviterId) return NextResponse.json({ error: "INVALID_INVITATION" }, { status: 422 });
  const invitee = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!invitee) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const existing = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: invitee.id } },
  });
  if (existing && existing.status !== "REJECTED") {
    return NextResponse.json({ error: "COLLABORATION_EXISTS" }, { status: 409 });
  }
  const collaborator = existing
    ? await prisma.projectCollaborator.update({
      where: { id: existing.id },
      data: { role: parsed.data.role, status: "PENDING", invitedById: inviterId },
    })
    : await prisma.projectCollaborator.create({
      data: { projectId: params.id, userId: invitee.id, role: parsed.data.role, status: "PENDING", invitedById: inviterId },
    });

  await createNotification(invitee.id, inviterId, "PROJECT_INVITE", params.id);
  await recordInteraction(inviterId, "TEAM", collaborator.id, `${inviterId}:TEAM_INVITE:${collaborator.id}`);
  return NextResponse.json({ collaborator }, { status: existing ? 200 : 201 });
}