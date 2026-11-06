import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasVerifiedPremiumAccess, isPlatformAdmin } from "@/lib/premium";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";
import { getMakerGamification } from "@/lib/gamification";

export const dynamic = "force-dynamic";

const ANALYTICS_PAGE_SIZE = 12;

function analyticsPostInclude(userId: string) {
  return {
    author: {
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        handle: true,
        headline: true,
        skills: true,
        isVerified: true,
        emailVerified: true,
        marketplaceVerification: { select: { email: true, emailVerifiedAt: true, status: true, currentPeriodEnd: true } },
        userBadges: { select: { awardedAt: true, badge: { select: { key: true, name: true, icon: true } } } },
      },
    },
    project: {
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        githubUrl: true,
        logoUrl: true,
        coverUrl: true,
        teamName: true,
        creator: { select: { id: true, name: true, handle: true, image: true } },
        parentTeam: { select: { id: true, title: true, teamName: true, logoUrl: true } },
        collaborators: { where: { userId }, select: { status: true } },
      },
    },
    team: {
      select: {
        id: true,
        title: true,
        slug: true,
        logoUrl: true,
        teamName: true,
        status: true,
        collaborators: { where: { userId }, select: { status: true } },
      },
    },
    _count: { select: { likes: true, comments: true } },
    attachments: { select: { id: true, name: true, mimeType: true, size: true } },
    poll: { select: { id: true, type: true, question: true, options: true } },
  } as const;
}

export async function GET(request: Request) {
  const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 100_000) {
    return NextResponse.json({ error: "INVALID_PAGE" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!await hasVerifiedPremiumAccess(userId)) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }

  const today = new Date();
  const firstDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 29));
  const [gamification, analytics] = await Promise.all([
    getMakerGamification(userId),
    Promise.all([
      prisma.project.count({ where: { creatorId: userId } }),
      prisma.post.count({ where: { authorId: userId } }),
      prisma.like.count({ where: { post: { authorId: userId } } }),
      prisma.comment.count({ where: { post: { authorId: userId } } }),
      prisma.post.findMany({
        where: { authorId: userId },
        include: analyticsPostInclude(userId),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (requestedPage - 1) * ANALYTICS_PAGE_SIZE,
        take: ANALYTICS_PAGE_SIZE,
      }),
      prisma.post.findMany({
        where: { authorId: userId, createdAt: { gte: firstDay } },
        select: { createdAt: true },
      }),
      prisma.like.findMany({
        where: { post: { authorId: userId }, createdAt: { gte: firstDay } },
        select: { createdAt: true },
      }),
      prisma.comment.findMany({
        where: { post: { authorId: userId }, createdAt: { gte: firstDay } },
        select: { createdAt: true },
      }),
      prisma.post.groupBy({
        by: ["type"],
        where: { authorId: userId },
        _count: { _all: true },
      }),
      prisma.like.groupBy({
        by: ["reaction"],
        where: { post: { authorId: userId } },
        _count: { _all: true },
      }),
    ]),
  ]);
  const [projectCount, postCount, postReactions, commentsReceived, requestedPosts, recentPosts, recentLikes, recentComments, postTypes, reactionTypes] = analytics;
  const totalPages = Math.ceil(postCount / ANALYTICS_PAGE_SIZE);
  const page = Math.min(requestedPage, Math.max(1, totalPages));
  const posts = requestedPage === page
    ? requestedPosts
    : await prisma.post.findMany({
      where: { authorId: userId },
      include: analyticsPostInclude(userId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ANALYTICS_PAGE_SIZE,
      take: ANALYTICS_PAGE_SIZE,
    });
  const postIds = posts.map(({ id }) => id);
  const pollIds = posts.flatMap((post) => post.poll ? [post.poll.id] : []);
  const [likeGroups, pollVoteGroups, textAnswerGroups] = await Promise.all([
    postIds.length
      ? prisma.like.groupBy({
        by: ["postId", "reaction"],
        where: { postId: { in: postIds } },
        _count: { _all: true },
      })
      : Promise.resolve([]),
    pollIds.length
      ? prisma.pollVote.groupBy({
        by: ["pollId", "optionIndex"],
        where: { pollId: { in: pollIds } },
        _count: { _all: true },
      })
      : Promise.resolve([]),
    pollIds.length
      ? prisma.pollVote.groupBy({
        by: ["pollId", "answer"],
        where: { pollId: { in: pollIds }, answer: { not: null } },
        _count: { _all: true },
      })
      : Promise.resolve([]),
  ]);
  const reactionCountsByPostId = new Map<string, Record<string, number>>();
  for (const group of likeGroups) {
    const counts = reactionCountsByPostId.get(group.postId) ?? {};
    counts[group.reaction] = group._count._all;
    reactionCountsByPostId.set(group.postId, counts);
  }
  const voteCountsByPollId = new Map<string, number[]>();
  const totalVotesByPollId = new Map<string, number>();
  for (const group of pollVoteGroups) {
    totalVotesByPollId.set(group.pollId, (totalVotesByPollId.get(group.pollId) ?? 0) + group._count._all);
    if (group.optionIndex !== null) {
      const counts = voteCountsByPollId.get(group.pollId) ?? [];
      counts[group.optionIndex] = group._count._all;
      voteCountsByPollId.set(group.pollId, counts);
    }
  }
  const textAnswersByPollId = new Map<string, { answer: string; votes: number }[]>();
  for (const group of textAnswerGroups) {
    const answer = group.answer?.trim();
    if (!answer) continue;
    const answers = textAnswersByPollId.get(group.pollId) ?? [];
    answers.push({ answer, votes: group._count._all });
    textAnswersByPollId.set(group.pollId, answers);
  }
  const postsByDay = new Map<string, number>();
  const engagementByDay = new Map<string, number>();
  for (const post of recentPosts) {
    const key = post.createdAt.toISOString().slice(0, 10);
    postsByDay.set(key, (postsByDay.get(key) ?? 0) + 1);
  }
  for (const interaction of [...recentLikes, ...recentComments]) {
    const key = interaction.createdAt.toISOString().slice(0, 10);
    engagementByDay.set(key, (engagementByDay.get(key) ?? 0) + 1);
  }
  const activity = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(firstDay);
    date.setUTCDate(firstDay.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      posts: postsByDay.get(key) ?? 0,
      engagement: engagementByDay.get(key) ?? 0,
    };
  });
  const pagePosts = posts.map((post) => {
    const { project, team, poll, author: postAuthor, ...postData } = post;
    const { email, emailVerified, marketplaceVerification, userBadges, ...author } = postAuthor;
    const contextProject = post.type === "TEAM" ? team ?? project : project;
    const reactionCounts = reactionCountsByPostId.get(post.id) ?? {};
    const reactionTotal = Object.values(reactionCounts).reduce((total, count) => total + count, 0);
    return {
      ...postData,
      shareCount: post.shareCount,
      _count: { ...post._count, likes: reactionTotal },
      author: {
        ...author,
        isVerified: isPlatformAdmin(email)
          || (author.isVerified && Boolean(emailVerified))
          || Boolean(emailVerified
            && email.toLowerCase() === marketplaceVerification?.email.toLowerCase()
            && marketplaceVerification.emailVerifiedAt
            && hasActiveMarketplaceVerification(marketplaceVerification)),
        badges: userBadges.map(({ badge, awardedAt }) => ({ key: badge.key, name: badge.name, icon: badge.icon, awardedAt })),
      },
      project: contextProject ? {
        id: contextProject.id,
        title: contextProject.title,
        slug: contextProject.slug,
        status: contextProject.status,
        githubUrl: project?.githubUrl ?? null,
        logoUrl: contextProject.logoUrl,
        teamName: contextProject.teamName,
        collaborationStatus: contextProject.collaborators[0]?.status ?? null,
        ...(project ? {
          coverUrl: project.coverUrl,
          creator: project.creator,
          parentTeam: project.parentTeam,
        } : {}),
      } : null,
      team: team ? {
        id: team.id,
        title: team.title,
        slug: team.slug,
        logoUrl: team.logoUrl,
        teamName: team.teamName,
      } : null,
      reactionCounts,
      poll: poll ? {
        id: poll.id,
        type: poll.type,
        question: poll.question,
        options: poll.options,
        totalVotes: totalVotesByPollId.get(poll.id) ?? 0,
        voteCounts: poll.options.map((_, index) => voteCountsByPollId.get(poll.id)?.[index] ?? 0),
        myVote: null,
        resultsVisible: true,
        textAnswers: textAnswersByPollId.get(poll.id) ?? [],
        myAnswer: null,
      } : null,
      engagement: reactionTotal + post._count.comments,
    };
  });

  return NextResponse.json({
    standing: gamification.standing,
    projects: projectCount,
    posts: postCount,
    reactions: postReactions,
    comments: commentsReceived,
    activity,
    distribution: Object.fromEntries(postTypes.map(({ type, _count }) => [type, _count._all])),
    reactionDistribution: Object.fromEntries(reactionTypes.map(({ reaction, _count }) => [reaction, _count._all])),
    topPosts: pagePosts,
    pagination: { page, pageSize: ANALYTICS_PAGE_SIZE, total: postCount, totalPages },
  });
}