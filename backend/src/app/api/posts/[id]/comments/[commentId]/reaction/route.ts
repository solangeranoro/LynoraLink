import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentReactionSchema } from "@/lib/validators";
import { canViewPost } from "@/lib/project-access";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string; commentId: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewPost(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  }
  const parsed = commentReactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  const comment = await prisma.comment.findFirst({
    where: { id: params.commentId, postId: params.id },
    select: { id: true },
  });
  if (!comment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const existing = await prisma.commentReaction.findUnique({
      where: { userId_commentId: { userId: session.user.id, commentId: comment.id } },
    });
    let reaction: string | null;
    if (existing?.reaction === parsed.data.reaction) {
      await prisma.commentReaction.delete({ where: { id: existing.id } });
      reaction = null;
    } else if (existing) {
      await prisma.commentReaction.update({ where: { id: existing.id }, data: { reaction: parsed.data.reaction } });
      reaction = parsed.data.reaction;
    } else {
      await prisma.commentReaction.create({
        data: { userId: session.user.id, commentId: comment.id, reaction: parsed.data.reaction },
      });
      reaction = parsed.data.reaction;
    }

    const grouped = await prisma.commentReaction.groupBy({
      by: ["reaction"],
      where: { commentId: comment.id },
      _count: { _all: true },
    });
    const reactionCounts = Object.fromEntries(grouped.map((item) => [item.reaction, item._count._all]));
    const count = Object.values(reactionCounts).reduce((total, reactionCount) => total + reactionCount, 0);
    return NextResponse.json({ reaction, count, reactionCounts });
  } catch (error) {
    console.error("Toggle comment reaction error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}