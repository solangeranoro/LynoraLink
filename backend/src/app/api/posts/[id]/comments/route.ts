import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validators";
import { createNotification } from "@/lib/notifications";
import { recordInteraction, refreshUserBadges } from "@/lib/gamification";
import { canViewPost } from "@/lib/project-access";

export const dynamic = "force-dynamic";

type SerializedComment = {
  id: string;
  content: string;
  codeSnippet: string | null;
  imageUrl: string | null;
  githubUrl: string | null;
  parentId: string | null;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null; handle: string | null };
  reactionByMe: string | null;
  reactionCounts: Record<string, number>;
  replies: SerializedComment[];
  _count: { reactions: number; replies: number };
};

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!(await canViewPost(params.id, session?.user?.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const post = await prisma.post.findUnique({ where: { id: params.id }, select: { id: true, authorId: true } });
    if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const comments = await prisma.comment.findMany({
      where: { postId: post.id },
      include: {
        author: { select: { id: true, name: true, image: true, handle: true } },
        reactions: session?.user?.id
          ? { where: { userId: session.user.id }, select: { reaction: true } }
          : false,
        _count: { select: { reactions: true, replies: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const reactionGroups = comments.length
      ? await prisma.commentReaction.groupBy({
        by: ["commentId", "reaction"],
        where: { commentId: { in: comments.map(({ id }) => id) } },
        _count: { _all: true },
      })
      : [];
    const reactionCountsByCommentId = new Map<string, Record<string, number>>();
    for (const group of reactionGroups) {
      const reactionCounts = reactionCountsByCommentId.get(group.commentId) ?? {};
      reactionCounts[group.reaction] = group._count._all;
      reactionCountsByCommentId.set(group.commentId, reactionCounts);
    }

    const commentsById = new Map<string, SerializedComment>();
    for (const comment of comments) {
      const reactionCounts = reactionCountsByCommentId.get(comment.id) ?? {};
      const reactionCount = Object.values(reactionCounts).reduce((total, count) => total + count, 0);
      commentsById.set(comment.id, {
        id: comment.id,
        content: comment.content,
        codeSnippet: comment.codeSnippet,
        imageUrl: comment.imageUrl,
        githubUrl: comment.githubUrl,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        author: comment.author,
        reactionByMe: Array.isArray(comment.reactions) ? comment.reactions[0]?.reaction ?? null : null,
        reactionCounts,
        replies: [],
        _count: { ...comment._count, reactions: reactionCount },
      });
    }

    const roots: SerializedComment[] = [];
    for (const comment of comments) {
      const serialized = commentsById.get(comment.id);
      if (!serialized) continue;
      const parent = comment.parentId ? commentsById.get(comment.parentId) : undefined;
      if (parent) parent.replies.push(serialized);
      else roots.push(serialized);
    }

    return NextResponse.json({ comments: roots });
  } catch (error) {
    console.error("Get post comments error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
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
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  try {
    const post = await prisma.post.findUnique({ where: { id: params.id }, select: { id: true, authorId: true } });
    if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (parsed.data.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parsed.data.parentId },
        select: { postId: true },
      });
      if (!parent || parent.postId !== post.id) {
        return NextResponse.json({ error: "INVALID_PARENT" }, { status: 422 });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: parsed.data.content,
        codeSnippet: parsed.data.codeSnippet,
        imageUrl: parsed.data.imageUrl || null,
        githubUrl: parsed.data.githubUrl || null,
        postId: post.id,
        authorId: session.user.id,
        parentId: parsed.data.parentId,
      },
      include: {
        author: { select: { id: true, name: true, image: true, handle: true } },
        _count: { select: { reactions: true, replies: true } },
      },
    });
    await recordInteraction(session.user.id, "COMMENT", comment.id);
    if (post.authorId !== session.user.id) await refreshUserBadges(post.authorId);
    await createNotification(post.authorId, session.user.id, "POST_COMMENT", post.id);
    return NextResponse.json({ comment: { ...comment, reactionByMe: null, reactionCounts: {}, replies: [] } }, { status: 201 });
  } catch (error) {
    console.error("Create post comment error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}