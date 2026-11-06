import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

async function findPublishedApplication(id: string) {
  return prisma.testerApplication.findFirst({
    where: { id, status: "APPROVED" },
    select: { id: true, ownerId: true },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const application = await findPublishedApplication(id);
  if (!application) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const interactions = await prisma.testerApplicationActivity.findMany({
    where: {
      applicationId: id,
      OR: [
        { type: { in: ["REVIEW", "COMMENT"] } },
        { type: "POLL", authorId: application.ownerId },
      ],
    },
    include: {
      author: { select: { id: true, name: true, handle: true, image: true } },
      votes: { select: { userId: true, option: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({
    interactions: interactions.map(({ votes, ...interaction }) => ({
      ...interaction,
      voteCounts: votes.reduce<Record<string, number>>((counts, vote) => {
        counts[vote.option] = (counts[vote.option] ?? 0) + 1;
        return counts;
      }, {}),
      userVote: votes.find((vote) => vote.userId === userId)?.option ?? null,
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const application = await findPublishedApplication(id);
  if (!application) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("REVIEW"), content: z.string().trim().min(3).max(2000), rating: z.number().int().min(1).max(5) }),
    z.object({ kind: z.literal("COMMENT"), content: z.string().trim().min(1).max(2000) }),
    z.object({ kind: z.literal("VOTE"), activityId: z.string().min(1), option: z.string().trim().min(1).max(80) }),
  ]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INTERACTION", details: parsed.error.flatten() }, { status: 422 });

  const input = parsed.data;
  if (input.kind === "VOTE") {
    const poll = await prisma.testerApplicationActivity.findFirst({
      where: { id: input.activityId, applicationId: id, authorId: application.ownerId, type: "POLL" },
      select: { id: true, options: true },
    });
    if (!poll || !poll.options.includes(input.option)) return NextResponse.json({ error: "INVALID_POLL_OPTION" }, { status: 422 });
    const vote = await prisma.testerApplicationPollVote.upsert({
      where: { activityId_userId: { activityId: poll.id, userId } },
      create: { activityId: poll.id, userId, option: input.option },
      update: { option: input.option },
    });
    return NextResponse.json({ vote }, { status: 200 });
  }

  if (input.kind === "REVIEW") {
    const existing = await prisma.testerApplicationActivity.findFirst({
      where: { applicationId: id, authorId: userId, type: "REVIEW" },
      select: { id: true },
    });
    const review = existing
      ? await prisma.testerApplicationActivity.update({
        where: { id: existing.id },
        data: { rating: input.rating, content: input.content },
        include: { author: { select: { id: true, name: true, handle: true, image: true } } },
      })
      : await prisma.testerApplicationActivity.create({
        data: { applicationId: id, authorId: userId, type: "REVIEW", rating: input.rating, content: input.content },
        include: { author: { select: { id: true, name: true, handle: true, image: true } } },
      });
    return NextResponse.json({ interaction: review }, { status: existing ? 200 : 201 });
  }

  const interaction = await prisma.testerApplicationActivity.create({
    data: { applicationId: id, authorId: userId, type: "COMMENT", content: input.content },
    include: { author: { select: { id: true, name: true, handle: true, image: true } } },
  });
  return NextResponse.json({ interaction }, { status: 201 });
}
