import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canContributeToProject, canViewProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { recordInteraction } from "@/lib/gamification";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewProject(params.id, userId))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const tasks = await prisma.projectTask.findMany({
    where: { projectId: params.id },
    include: { assignee: { select: { id: true, name: true, image: true, handle: true } } },
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
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
  const parsed = z.object({ title: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TASK" }, { status: 422 });

  const position = await prisma.projectTask.count({ where: { projectId: params.id, status: "TODO" } });
  const task = await prisma.projectTask.create({
    data: { ...parsed.data, projectId: params.id, creatorId: userId, position },
    include: { assignee: { select: { id: true, name: true, image: true, handle: true } } },
  });
  await recordInteraction(userId, "TEAM", task.id);
  return NextResponse.json({ task }, { status: 201 });
}