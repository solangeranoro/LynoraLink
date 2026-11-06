import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string; pollId: string }> };

const pollSchema = z.object({
  title: z.string().trim().min(5).max(200),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
}).strict();

async function canManagePolls(applicationId: string, userId: string) {
  return prisma.testerApplication.findFirst({
    where: { id: applicationId, ownerId: userId },
    select: { id: true },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id, pollId } = await context.params;
  if (!(await canManagePolls(id, userId))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_POLL", details: parsed.error.flatten() }, { status: 422 });
  if (new Set(parsed.data.options).size !== parsed.data.options.length) {
    return NextResponse.json({ error: "POLL_REQUIRES_UNIQUE_OPTIONS" }, { status: 422 });
  }

  const poll = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.testerApplicationActivity.findFirst({
      where: { id: pollId, applicationId: id, authorId: userId, type: "POLL" },
      select: { id: true },
    });
    if (!existing) return null;

    await transaction.testerApplicationPollVote.deleteMany({
      where: { activityId: pollId, option: { notIn: parsed.data.options } },
    });
    return transaction.testerApplicationActivity.update({
      where: { id: pollId },
      data: { title: parsed.data.title, options: parsed.data.options },
      select: { id: true, title: true, options: true },
    });
  });
  if (!poll) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ poll });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id, pollId } = await context.params;
  if (!(await canManagePolls(id, userId))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const deleted = await prisma.testerApplicationActivity.deleteMany({
    where: { id: pollId, applicationId: id, authorId: userId, type: "POLL" },
  });
  if (!deleted.count) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
