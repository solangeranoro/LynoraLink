import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { recordInteraction } from "@/lib/gamification";

const responseSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = responseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_RESPONSE" }, { status: 422 });

  const invitation = await prisma.projectCollaborator.findFirst({
    where: { id: params.collaboratorId, projectId: params.id, userId, invitedById: { not: null }, status: "PENDING" },
    select: { id: true, project: { select: { creatorId: true } } },
  });
  if (!invitation) return NextResponse.json({ error: "INVITATION_NOT_FOUND" }, { status: 404 });

  const collaborator = await prisma.projectCollaborator.update({
    where: { id: invitation.id },
    data: { status: parsed.data.status },
  });
  if (collaborator.status === "APPROVED" && collaborator.role !== "FOUNDER") {
    await recordInteraction(userId, "TEAM", collaborator.id);
  }
  await createNotification(invitation.project.creatorId, userId, parsed.data.status === "APPROVED" ? "PROJECT_ACCEPTED" : "PROJECT_DECLINED", params.id);
  return NextResponse.json({ collaborator });
}