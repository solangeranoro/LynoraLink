import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePostSchema } from "@/lib/validators";
import { canViewPost } from "@/lib/project-access";

export const dynamic = "force-dynamic";

async function getOwnedPost(postId: string, userId: string) {
  if (!(await canViewPost(postId, userId))) return { response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }) };
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post) return { response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }) };
  if (post.authorId !== userId) return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { post };
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const owned = await getOwnedPost(params.id, session.user.id);
  if (owned.response) return owned.response;

  try {
    const parsed = updatePostSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
    const post = await prisma.post.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json({ post });
  } catch (error) {
    console.error("Update post error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const owned = await getOwnedPost(params.id, session.user.id);
  if (owned.response) return owned.response;

  try {
    await prisma.post.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}