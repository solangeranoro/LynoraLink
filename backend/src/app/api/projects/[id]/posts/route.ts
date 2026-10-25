import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const moderationStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;

export async function GET(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { creatorId: true } });
  if (!project || project.creatorId !== session.user.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const requestedStatus = new URL(request.url).searchParams.get("status");
  if (requestedStatus && requestedStatus !== "ALL" && !moderationStatuses.includes(requestedStatus as typeof moderationStatuses[number])) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }

  const posts = await prisma.post.findMany({
    where: {
      OR: [{ projectId: params.id }, { teamId: params.id }],
      ...(requestedStatus && requestedStatus !== "ALL" ? { moderationStatus: requestedStatus as typeof moderationStatuses[number] } : {}),
    },
    include: {
      author: { select: { id: true, name: true, image: true, handle: true, headline: true } },
      attachments: { select: { id: true, name: true, mimeType: true, size: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ posts });
}