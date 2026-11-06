import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const pollSchema = z.object({
  title: z.string().trim().min(5).max(200),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
}).strict();

async function findOwnedApplication(id: string, userId: string) {
  return prisma.testerApplication.findFirst({
    where: { id, ownerId: userId },
    select: { id: true },
  });
}

function haveUniqueOptions(options: string[]) {
  return new Set(options).size === options.length;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await context.params;
  if (!(await findOwnedApplication(id, userId))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const polls = await prisma.testerApplicationActivity.findMany({
    where: { applicationId: id, authorId: userId, type: "POLL" },
    include: { votes: { select: { option: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({
    polls: polls.map(({ votes, ...poll }) => {
      const voteCounts = votes.reduce<Record<string, number>>((counts, vote) => {
        counts[vote.option] = (counts[vote.option] ?? 0) + 1;
        return counts;
      }, {});
      return {
        ...poll,
        voteCounts,
        totalVotes: votes.length,
      };
    }),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await context.params;
  if (!(await findOwnedApplication(id, userId))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_POLL", details: parsed.error.flatten() }, { status: 422 });
  if (!haveUniqueOptions(parsed.data.options)) return NextResponse.json({ error: "POLL_REQUIRES_UNIQUE_OPTIONS" }, { status: 422 });

  const poll = await prisma.testerApplicationActivity.create({
    data: {
      applicationId: id,
      authorId: userId,
      type: "POLL",
      title: parsed.data.title,
      options: parsed.data.options,
    },
    select: { id: true, title: true, options: true },
  });
  return NextResponse.json({ poll }, { status: 201 });
}
