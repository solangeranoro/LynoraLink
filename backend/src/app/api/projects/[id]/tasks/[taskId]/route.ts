import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canContributeToProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { recordInteraction } from "@/lib/gamification";

type Context = { params: Promise<{ id: string; taskId: string }> };

export async function PATCH(request: Request, props: Context) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canContributeToProject(params.id, userId))) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({ status: z.enum(["TODO", "IN_PROGRESS", "DONE"]) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 422 });

  const task = await prisma.projectTask.findFirst({ where: { id: params.taskId, projectId: params.id }, select: { id: true, status: true } });
  if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const position = await prisma.projectTask.count({ where: { projectId: params.id, status: parsed.data.status } });
  const updated = await prisma.projectTask.update({
    where: { id: task.id },
    data: { status: parsed.data.status, position },
    include: { assignee: { select: { id: true, name: true, image: true, handle: true } } },
  });
  if (updated.status !== task.status) {
    await recordInteraction(userId, "TEAM", updated.id, `${userId}:TEAM_PROGRESS:${updated.id}:${updated.updatedAt.getTime()}`);
  }
  return NextResponse.json({ task: updated });
}

export async function DELETE(_request: Request, props: Context) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canContributeToProject(params.id, userId))) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const result = await prisma.projectTask.deleteMany({ where: { id: params.taskId, projectId: params.id } });
  if (!result.count) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}