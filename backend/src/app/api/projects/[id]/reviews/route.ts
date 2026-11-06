import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canViewProject } from "@/lib/project-access";

const reviewLabels = ["Très mauvais", "Mauvais", "Moyen", "Bon", "Excellent"];
const PAGE_SIZE = 10;

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!(await canViewProject(params.id, session?.user?.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const url = new URL(request.url);
  const ratingParam = url.searchParams.get("rating");
  const sortParam = url.searchParams.get("sort") ?? "newest";
  const pageParam = url.searchParams.get("page") ?? "1";
  const rating = ratingParam === null ? undefined : Number(ratingParam);
  const page = Number(pageParam);
  if ((rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) || !["newest", "oldest"].includes(sortParam) || !Number.isSafeInteger(page) || page < 1) {
    return NextResponse.json({ error: "INVALID_FILTER" }, { status: 422 });
  }

  const where = { targetId: params.id };
  const filteredWhere = { ...where, ...(rating ? { rating } : {}) };
  const [aggregate, groupedRatings, filteredCount, reviews, userReview] = await Promise.all([
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    prisma.review.count({ where: filteredWhere }),
    prisma.review.findMany({
      where: filteredWhere,
      include: { user: { select: { id: true, name: true, handle: true, image: true } } },
      orderBy: [{ createdAt: sortParam === "oldest" ? "asc" : "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    session?.user?.id
      ? prisma.review.findUnique({ where: { userId_targetId: { userId: session.user.id, targetId: params.id } } })
      : null,
  ]);

  return NextResponse.json({
    reviews,
    userReview,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: filteredCount,
      totalPages: Math.max(1, Math.ceil(filteredCount / PAGE_SIZE)),
    },
    summary: {
      average: aggregate._avg.rating ?? 0,
      total: aggregate._count._all,
      ratingCounts: Object.fromEntries(groupedRatings.map(({ rating: score, _count }) => [score, _count._all])),
    },
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
  const parsed = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REVIEW" }, { status: 422 });

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { rating, comment } = parsed.data;
  const review = await prisma.review.upsert({
    where: { userId_targetId: { userId, targetId: params.id } },
    create: { userId, targetId: params.id, rating, label: reviewLabels[rating - 1], comment: comment || null },
    update: { rating, label: reviewLabels[rating - 1], comment: comment || null },
    include: { user: { select: { id: true, name: true, handle: true, image: true } } },
  });
  return NextResponse.json({ review }, { status: 201 });
}