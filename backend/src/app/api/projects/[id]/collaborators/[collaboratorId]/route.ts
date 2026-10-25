import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { recordInteraction } from "@/lib/gamification";

type RouteContext = { params: Promise<{ id: string; collaboratorId: string }> };
const updateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]).optional(),
  role: z.enum(["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"]).optional(),
}).refine((data) => data.status !== undefined || data.role !== undefined);

async function getOwnerProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { creatorId: true } });
  return project?.creatorId === userId;
}

export async function PATCH(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await getOwnerProject(params.id, session.user.id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  const collaborator = await prisma.projectCollaborator.findFirst({
    where: { id: params.collaboratorId, projectId: params.id },
  });
  if (!collaborator) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (parsed.data.status && collaborator.status !== "PENDING") {
    return NextResponse.json({ error: "REQUEST_ALREADY_REVIEWED" }, { status: 409 });
  }
  if (parsed.data.role && (collaborator.status !== "APPROVED" || collaborator.role === "FOUNDER")) {
    return NextResponse.json({ error: "ROLE_NOT_EDITABLE" }, { status: 409 });
  }

  const updated = await prisma.projectCollaborator.update({
    where: { id: collaborator.id },
    data: parsed.data,
    include: { user: { select: { id: true, name: true, image: true, handle: true, headline: true } } },
  });
  if (parsed.data.status === "APPROVED") {
    if (updated.role !== "FOUNDER") await recordInteraction(updated.userId, "TEAM", updated.id);
    await createNotification(collaborator.userId, session.user.id, "PROJECT_ACCEPTED", params.id);
  }
  if (parsed.data.status === "REJECTED") await createNotification(collaborator.userId, session.user.id, "PROJECT_DECLINED", params.id);
  return NextResponse.json({ collaborator: updated });
}

export async function DELETE(_request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const collaborator = await prisma.projectCollaborator.findFirst({
    where: { id: params.collaboratorId, projectId: params.id },
    select: { id: true, userId: true, status: true, role: true, invitedById: true },
  });
  if (!collaborator) return NextResponse.json({ error: "MEMBER_NOT_REMOVABLE" }, { status: 404 });

  const isOwner = await getOwnerProject(params.id, session.user.id);
  const isPendingInvitation = collaborator?.status === "PENDING" && collaborator.invitedById === session.user.id;
  const isApprovedMember = collaborator?.status === "APPROVED" && collaborator.role !== "FOUNDER" && collaborator.userId !== session.user.id;
  const isSelfLeaving = collaborator.userId === session.user.id
    && collaborator.role !== "FOUNDER"
    && (collaborator.status === "APPROVED" || (collaborator.status === "PENDING" && collaborator.invitedById === null));
  if (!(isOwner && (isPendingInvitation || isApprovedMember)) && !isSelfLeaving) {
    return NextResponse.json({ error: "MEMBER_NOT_REMOVABLE" }, { status: 404 });
  }

  await prisma.projectCollaborator.delete({ where: { id: collaborator.id } });
  return NextResponse.json({ removed: true });
}