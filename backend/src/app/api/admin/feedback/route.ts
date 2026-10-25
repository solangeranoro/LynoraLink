import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const RESPONSE_LIMIT = 20;

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim().slice(0, 100) ?? "";
  const pageNumber = (key: string) => {
    const value = Number(params.get(key));
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  };
  const reviewsPage = pageNumber("reviewsPage");
  const pollsPage = pageNumber("pollsPage");
  const feedbackPage = pageNumber("feedbackPage");
  const pollsView = params.get("pollsView") === "stars" ? "stars" : params.get("pollsView") === "polls" ? "polls" : "all";
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const personSearch = [
    { name: contains(search) },
    { handle: contains(search) },
  ];
  const matchingProjects = search
    ? await prisma.project.findMany({
      where: {
        OR: [
          { title: contains(search) },
          { teamName: contains(search) },
        ],
      },
      select: { id: true },
    })
    : [];
  const matchingProjectIds = matchingProjects.map(({ id }) => id);
  const reviewWhere = search ? {
    OR: [
      { comment: contains(search) },
      { label: contains(search) },
      { user: { is: { OR: personSearch } } },
      ...(matchingProjectIds.length ? [{ targetId: { in: matchingProjectIds } }] : []),
    ],
  } : undefined;
  const pollWhere = {
    ...(pollsView === "stars" ? { type: "STAR" as const } : pollsView === "polls" ? { type: { not: "STAR" as const } } : {}),
    ...(search ? { OR: [
      { question: contains(search) },
      { post: { is: { content: contains(search) } } },
      { post: { is: { author: { is: { OR: personSearch } } } } },
      { votes: { some: { answer: contains(search) } } },
      { votes: { some: { user: { is: { OR: personSearch } } } } },
    ] } : {}),
  };
  const projectFeedbackWhere = search ? {
    OR: [
      { content: contains(search) },
      { author: { is: { OR: personSearch } } },
      { project: { is: { title: contains(search) } } },
      { project: { is: { teamName: contains(search) } } },
    ],
  } : undefined;
  const [
    reviewSummary,
    ratingGroups,
    reviewCount,
    pollCounts,
    pollVoteCount,
    starVoteCount,
    projectFeedbackCount,
    reviews,
    filteredReviewCount,
    polls,
    filteredPollCount,
    projectFeedback,
    filteredProjectFeedbackCount,
  ] = await Promise.all([
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.groupBy({ by: ["rating"], _count: { _all: true } }),
    prisma.review.count(),
    prisma.poll.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.pollVote.count(),
    prisma.pollVote.count({ where: { poll: { type: "STAR" } } }),
    prisma.projectFeedback.count(),
    prisma.review.findMany({
      where: reviewWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (reviewsPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        targetId: true,
        rating: true,
        label: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, name: true, handle: true } },
      },
    }),
    prisma.review.count({ where: reviewWhere }),
    prisma.poll.findMany({
      where: pollWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pollsPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        question: true,
        options: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            author: { select: { id: true, name: true, handle: true } },
          },
        },
        votes: {
          where: search ? {
            OR: [
              { answer: contains(search) },
              { user: { is: { OR: personSearch } } },
            ],
          } : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: RESPONSE_LIMIT,
          select: {
            id: true,
            optionIndex: true,
            answer: true,
            createdAt: true,
            user: { select: { id: true, name: true, handle: true } },
          },
        },
        _count: { select: { votes: true } },
      },
    }),
    prisma.poll.count({ where: pollWhere }),
    prisma.projectFeedback.findMany({
      where: projectFeedbackWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (feedbackPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        kind: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, handle: true } },
        project: { select: { id: true, title: true, teamName: true } },
      },
    }),
    prisma.projectFeedback.count({ where: projectFeedbackWhere }),
  ]);

  const projectIds = [...new Set(reviews.map((review) => review.targetId))];
  const projects = projectIds.length
    ? await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, title: true, teamName: true },
    })
    : [];
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const pollIds = polls.map((poll) => poll.id);
  const voteGroups = pollIds.length
    ? await prisma.pollVote.groupBy({
      by: ["pollId", "optionIndex"],
      where: { pollId: { in: pollIds }, optionIndex: { not: null } },
      _count: { _all: true },
    })
    : [];

  return NextResponse.json({
    summary: {
      reviews: reviewCount,
      averageRating: reviewSummary._avg.rating ?? 0,
      ratingCounts: Object.fromEntries(ratingGroups.map(({ rating, _count }) => [rating, _count._all])),
      polls: Object.fromEntries(pollCounts.map(({ type, _count }) => [type, _count._all])),
      pollVotes: pollVoteCount,
      starVotes: starVoteCount,
      projectFeedback: projectFeedbackCount,
    },
    reviews: reviews.map((review) => ({
      ...review,
      project: projectsById.get(review.targetId) ?? null,
    })),
    polls: polls.map((poll) => ({
      ...poll,
      optionResults: voteGroups
        .filter((group) => group.pollId === poll.id && group.optionIndex !== null)
        .map((group) => ({ optionIndex: group.optionIndex, votes: group._count._all })),
    })),
    projectFeedback,
    pagination: {
      reviews: { page: reviewsPage, pageSize: PAGE_SIZE, total: filteredReviewCount, pages: Math.ceil(filteredReviewCount / PAGE_SIZE) },
      polls: { page: pollsPage, pageSize: PAGE_SIZE, total: filteredPollCount, pages: Math.ceil(filteredPollCount / PAGE_SIZE) },
      projectFeedback: { page: feedbackPage, pageSize: PAGE_SIZE, total: filteredProjectFeedbackCount, pages: Math.ceil(filteredProjectFeedbackCount / PAGE_SIZE) },
    },
    limits: { pageSize: PAGE_SIZE, responsesPerPoll: RESPONSE_LIMIT },
  });
}
