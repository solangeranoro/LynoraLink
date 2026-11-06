import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      include: { actor: { select: { id: true, name: true, handle: true, image: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
  ]);
  const invitedProjectIds = notifications
    .filter((notification) => notification.type === "PROJECT_INVITE")
    .map((notification) => notification.targetId);
  const invitedProjects = invitedProjectIds.length
    ? await prisma.project.findMany({
      where: { id: { in: invitedProjectIds } },
      select: { id: true, teamName: true },
    })
    : [];
  const teamProjectIds = new Set(invitedProjects.filter((project) => project.teamName?.trim()).map((project) => project.id));
  return NextResponse.json({
    notifications: notifications.map(({ actor, ...notification }) => ({
      ...notification,
      actor: actor ? { id: actor.id, name: actor.name, handle: actor.handle, image: actor.image } : null,
      actorIsPlatformAdmin: isPlatformAdmin(actor?.email),
      targetIsTeam: notification.type === "PROJECT_INVITE" && teamProjectIds.has(notification.targetId),
    })),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({ id: z.string().optional(), all: z.boolean().optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 422 });
  await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null, ...(parsed.data.all ? {} : parsed.data.id ? { id: parsed.data.id } : {}) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}