import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordInteraction } from "@/lib/gamification";
import { canViewPost } from "@/lib/project-access";

const pollVoteSchema = z.union([
  z.object({ answer: z.string().trim().min(1).max(500) }).strict(),
  z.object({ optionIndex: z.number().int().min(0) }).strict(),
  z.object({ rating: z.number().int().min(1).max(5) }).strict(),
]);

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!(await canViewPost(params.id, session?.user?.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const poll = await prisma.poll.findUnique({
    where: { postId: params.id },
    select: {
      id: true,
      type: true,
      question: true,
      options: true,
      post: { select: { authorId: true } },
    },
  });
  if (!poll) return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
  const myPollVote = session?.user?.id
    ? await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: session.user.id } },
      select: { optionIndex: true, answer: true },
    })
    : null;
  const resultsVisible = poll.type === "STAR" || poll.post.authorId === session?.user?.id || Boolean(myPollVote);
  const [voteGroups, textAnswerGroups] = resultsVisible
    ? await Promise.all([
      prisma.pollVote.groupBy({
        by: ["optionIndex"],
        where: { pollId: poll.id },
        _count: { _all: true },
      }),
      poll.type === "TEXT"
        ? prisma.pollVote.groupBy({
          by: ["answer"],
          where: { pollId: poll.id, answer: { not: null } },
          _count: { _all: true },
        })
        : Promise.resolve([]),
    ])
    : [[], []];
  const textAnswerCounts = new Map<string, number>();
  for (const group of textAnswerGroups) {
    const answer = group.answer?.trim();
    if (answer) textAnswerCounts.set(answer, (textAnswerCounts.get(answer) ?? 0) + group._count._all);
  }
  return NextResponse.json({
    id: poll.id,
    type: poll.type,
    question: poll.question,
    options: poll.options,
    totalVotes: voteGroups.reduce((total, group) => total + group._count._all, 0),
    voteCounts: poll.options.map((_, index) => voteGroups.find((group) => group.optionIndex === index)?._count._all ?? 0),
    myVote: myPollVote?.optionIndex ?? null,
    resultsVisible,
    textAnswers: [...textAnswerCounts].map(([answer, votes]) => ({ answer, votes })),
    myAnswer: myPollVote?.answer ?? null,
  });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewPost(params.id, userId))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = pollVoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_VOTE" }, { status: 422 });

  const poll = await prisma.poll.findUnique({ where: { postId: params.id }, select: { id: true, type: true, options: true } });
  if (!poll) return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
  let optionIndex: number | null = null;
  let answer: string | null = null;
  if (poll.type === "TEXT") {
    if (!("answer" in parsed.data)) return NextResponse.json({ error: "INVALID_ANSWER" }, { status: 422 });
    answer = parsed.data.answer;
    await prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId } },
      create: { pollId: poll.id, userId, answer, optionIndex: null },
      update: { answer, optionIndex: null },
    });
  } else if (poll.type === "STAR") {
    if (!("rating" in parsed.data) || parsed.data.rating > poll.options.length) {
      return NextResponse.json({ error: "INVALID_RATING" }, { status: 422 });
    }
    optionIndex = parsed.data.rating - 1;
    await prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId } },
      create: { pollId: poll.id, userId, optionIndex, answer: null },
      update: { optionIndex, answer: null },
    });
  } else {
    if (!("optionIndex" in parsed.data) || parsed.data.optionIndex >= poll.options.length) {
      return NextResponse.json({ error: "INVALID_OPTION" }, { status: 422 });
    }
    optionIndex = parsed.data.optionIndex;
    await prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId } },
      create: { pollId: poll.id, userId, optionIndex, answer: null },
      update: { optionIndex, answer: null },
    });
  }

  await recordInteraction(userId, "POLL", poll.id);

  const [myPollVote, voteGroups, textAnswerGroups] = await Promise.all([
    prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId } },
      select: { optionIndex: true, answer: true },
    }),
    prisma.pollVote.groupBy({
      by: ["optionIndex"],
      where: { pollId: poll.id },
      _count: { _all: true },
    }),
    poll.type === "TEXT"
      ? prisma.pollVote.groupBy({
        by: ["answer"],
        where: { pollId: poll.id, answer: { not: null } },
        _count: { _all: true },
      })
      : Promise.resolve([]),
  ]);
  const textAnswerCounts = new Map<string, number>();
  for (const group of textAnswerGroups) {
    const text = group.answer?.trim();
    if (text) textAnswerCounts.set(text, (textAnswerCounts.get(text) ?? 0) + group._count._all);
  }
  return NextResponse.json({
    totalVotes: voteGroups.reduce((total, group) => total + group._count._all, 0),
    voteCounts: poll.options.map((_, index) => voteGroups.find((group) => group.optionIndex === index)?._count._all ?? 0),
    myVote: myPollVote?.optionIndex ?? null,
    myAnswer: myPollVote?.answer ?? null,
    resultsVisible: true,
    textAnswers: [...textAnswerCounts].map(([text, votes]) => ({ answer: text, votes })),
  });
}