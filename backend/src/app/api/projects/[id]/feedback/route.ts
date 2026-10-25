import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordInteraction } from "@/lib/gamification";
import { canViewProject } from "@/lib/project-access";

const PAGE_SIZE = 10;

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!(await canViewProject(params.id, session?.user?.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const requestedPage = pageParam === null ? 1 : Number(pageParam);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) return NextResponse.json({ error: "INVALID_PAGE" }, { status: 422 });
  const where = { projectId: params.id };
  const total = await prisma.projectFeedback.count({ where });
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const page = Math.min(requestedPage, Math.max(1, pageCount));
  const feedback = await prisma.projectFeedback.findMany({
    where,
    include: { author: { select: { id: true, name: true, image: true, handle: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return NextResponse.json({
    feedback,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, pageCount) },
  });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewProject(params.id, userId))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({ kind: z.enum(["IDEA", "QUESTION", "BUG"]), content: z.string().trim().min(5).max(2000) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_FEEDBACK" }, { status: 422 });
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const feedback = await prisma.projectFeedback.create({
    data: { ...parsed.data, projectId: params.id, authorId: userId },
    include: { author: { select: { id: true, name: true, image: true, handle: true } } },
  });
  await recordInteraction(userId, "FEEDBACK", feedback.id);
  return NextResponse.json({ feedback }, { status: 201 });
}