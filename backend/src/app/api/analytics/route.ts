import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasVerifiedPremiumAccess } from "@/lib/premium";

export const dynamic = "force-dynamic";

const ANALYTICS_PAGE_SIZE = 12;

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
  const [projectCount, postCount, postReactions, commentsReceived, requestedPosts, recentPosts, recentLikes, recentComments, postTypes, reactionTypes] = await Promise.all([
    prisma.project.count({ where: { creatorId: userId } }),
    prisma.post.count({ where: { authorId: userId } }),
    prisma.like.count({ where: { post: { authorId: userId } } }),
    prisma.comment.count({ where: { post: { authorId: userId } } }),
    prisma.post.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        content: true,
        imageUrl: true,
        tags: true,
        type: true,
        createdAt: true,
        _count: { select: { likes: true, comments: true } },
      },
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
  ]);
  const totalPages = Math.ceil(postCount / ANALYTICS_PAGE_SIZE);
  const page = Math.min(requestedPage, Math.max(1, totalPages));
  const posts = requestedPage === page
    ? requestedPosts
    : await prisma.post.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        content: true,
        imageUrl: true,
        tags: true,
        type: true,
        createdAt: true,
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ANALYTICS_PAGE_SIZE,
      take: ANALYTICS_PAGE_SIZE,
    });
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
  const pagePosts = posts.map((post) => ({
    id: post.id,
    excerpt: post.content.slice(0, 180),
    imageUrl: post.imageUrl,
    tags: post.tags,
    type: post.type,
    createdAt: post.createdAt,
    reactions: post._count.likes,
    comments: post._count.comments,
    engagement: post._count.likes + post._count.comments,
  }));

  return NextResponse.json({
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