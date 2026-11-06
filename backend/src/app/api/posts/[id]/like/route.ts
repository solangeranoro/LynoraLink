import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { recordInteraction, refreshUserBadges } from "@/lib/gamification";
import { canViewPost } from "@/lib/project-access";

const REACTIONS = ["like", "love", "celebrate", "support", "laugh", "insightful"] as const;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewPost(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  let requestedReaction: unknown = "like";
  try {
    const body = await req.json();
    if (body && typeof body === "object" && "reaction" in body) requestedReaction = body.reaction;
  } catch {
    // Keep the original empty-body request compatible with the default like reaction.
  }
  if (typeof requestedReaction !== "string" || !REACTIONS.includes(requestedReaction as typeof REACTIONS[number])) {
    return NextResponse.json({ error: "INVALID_REACTION" }, { status: 422 });
  }

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { authorId: true } });
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: session.user.id, postId: params.id } },
  });
  let reaction: string | null;
  if (existing?.reaction === requestedReaction) {
    await prisma.like.delete({ where: { id: existing.id } });
    reaction = null;
  } else if (existing) {
    await prisma.like.update({ where: { id: existing.id }, data: { reaction: requestedReaction } });
    reaction = requestedReaction;
  } else {
    await prisma.like.create({ data: { userId: session.user.id, postId: params.id, reaction: requestedReaction } });
    await recordInteraction(session.user.id, "LIKE", params.id);
    if (post.authorId !== session.user.id) await refreshUserBadges(post.authorId);
    await createNotification(post.authorId, session.user.id, "POST_REACTION", params.id);
    reaction = requestedReaction;
  }

  const groupedReactions = await prisma.like.groupBy({
    by: ["reaction"],
    where: { postId: params.id },
    _count: { _all: true },
  });
  const reactionCounts = Object.fromEntries(groupedReactions.map(({ reaction: key, _count }) => [key, _count._all]));
  const count = Object.values(reactionCounts).reduce((total, reactionCount) => total + reactionCount, 0);
  return NextResponse.json({ liked: reaction !== null, reaction, count, reactionCounts });
}