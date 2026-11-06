import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/project-access";
import { updatePostVisibilitySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { authorId: true },
  });
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (post.authorId !== session.user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!(await canViewPost(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  }
  const parsed = updatePostVisibilitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  try {
    const updated = await prisma.post.update({
      where: { id: params.id },
      data: { isHidden: parsed.data.isHidden },
      select: { isHidden: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update post visibility error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
