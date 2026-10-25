import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const applicationSchema = z.object({
  role: z.enum(["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"]).optional().default("CO_BUILDER"),
  message: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = applicationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_APPLICATION" }, { status: 422 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { creatorId: true, isPrivate: true, moderationStatus: true },
  });
  if (!project || project.isPrivate || project.moderationStatus !== "APPROVED") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const existing = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (existing && existing.status !== "REJECTED") {
    return NextResponse.json({ error: "ALREADY_REQUESTED", collaborator: { status: existing.status } }, { status: 409 });
  }
  try {
    const collaborator = existing
      ? await prisma.projectCollaborator.update({
        where: { id: existing.id },
        data: {
          role: parsed.data.role,
          status: "PENDING",
          invitedById: null,
          message: parsed.data.message || null,
          createdAt: new Date(),
        },
      })
      : await prisma.projectCollaborator.create({
        data: {
          projectId: params.id,
          userId: session.user.id,
          role: parsed.data.role,
          status: "PENDING",
          message: parsed.data.message || null,
        },
      });
    await createNotification(project.creatorId, session.user.id, "PROJECT_REQUEST", params.id);
    return NextResponse.json({ collaborator }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "ALREADY_REQUESTED", collaborator: { status: "PENDING" } }, { status: 409 });
    }
    throw error;
  }
}