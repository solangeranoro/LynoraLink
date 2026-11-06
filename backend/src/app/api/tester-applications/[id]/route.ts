import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const application = await prisma.testerApplication.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      problem: true,
      logoUrl: true,
      screenshotUrls: true,
      platform: true,
      createdDate: true,
      websiteUrl: true,
      downloadUrl: true,
      technologies: true,
      ownerName: true,
      ownerTitle: true,
      ownerCity: true,
      ownerCountry: true,
      status: true,
      rejectionReason: true,
      shares: true,
      ownerId: true,
      createdAt: true,
      _count: { select: { activities: true } },
    },
  });
  if (!application || (application.status !== "APPROVED" && application.ownerId !== userId)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const [[scenario], reviewSummary] = await Promise.all([
    prisma.$queryRaw<{ testInstructions: string }[]>`
      SELECT "testInstructions" FROM "TesterApplication" WHERE "id" = ${id}
    `,
    prisma.testerApplicationActivity.aggregate({
      where: { applicationId: id, type: "REVIEW", rating: { not: null } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
  return NextResponse.json({
    application: {
      ...application,
      testInstructions: scenario?.testInstructions ?? "",
      averageRating: reviewSummary._avg.rating,
      reviewCount: reviewSummary._count._all,
      canManage: application.ownerId === userId,
    },
  });
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const application = await prisma.testerApplication.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!application || application.status !== "APPROVED") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const updated = await prisma.testerApplication.update({
    where: { id },
    data: { shares: { increment: 1 } },
    select: { shares: true },
  });
  return NextResponse.json({ shares: updated.shares });
}
